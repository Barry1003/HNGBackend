import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getDb, saveDb } from '../db.js';
import { v7 as uuidv7 } from 'uuid';
import { getAgeGroup } from '../utils/classify.js';

const router = Router();

router.post('/profiles', async (req: Request, res: Response) => {
  const { name } = req.body;

  if (name === undefined || name === null) {
    return res.status(400).json({ status: 'error', message: 'Missing or empty name' });
  }
  if (typeof name !== 'string') {
    return res.status(422).json({ status: 'error', message: 'Invalid type' });
  }
  if (name.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Missing or empty name' });
  }

  const cleanName = name.trim();
  const nameLower = cleanName.toLowerCase();

  try {
    const db = await getDb();

    const existingRows = db.exec('SELECT id, name, gender, probability, count, age, age_group, country_id, country_probability, created_at FROM profiles WHERE name_lower = ?', [nameLower]);
    if (existingRows.length > 0 && existingRows[0].values.length > 0) {
      const cols = existingRows[0].columns;
      const vals = existingRows[0].values[0];
      const existing: any = {};
      cols.forEach((col: string, i: number) => { existing[col] = vals[i]; });
      return res.json({
        status: 'success',
        message: 'Profile already exists',
        data: existing
      });
    }

    // Fetch from all APIs concurrently
    let gData: any, aData: any, nData: any;
    try {
      const [gRes, aRes, nRes] = await Promise.all([
        axios.get(`https://api.genderize.io?name=${encodeURIComponent(cleanName)}`, { timeout: 5000 }).catch(() => ({ data: {} })),
        axios.get(`https://api.agify.io?name=${encodeURIComponent(cleanName)}`, { timeout: 5000 }).catch(() => ({ data: {} })),
        axios.get(`https://api.nationalize.io?name=${encodeURIComponent(cleanName)}`, { timeout: 5000 }).catch(() => ({ data: {} }))
      ]);
      gData = gRes.data;
      aData = aRes.data;
      nData = nRes.data;
    } catch (err: any) {
      console.error('Upstream API error:', err.message);
      return res.status(502).json({ status: 'error', message: 'Upstream service error' });
    }

    const id = uuidv7();
    const gender = gData.gender || 'unknown';
    const probability = gData.probability || 0;
    const count = gData.count || 0;
    const age = aData.age !== null && aData.age !== undefined ? aData.age : 30; // default age 30 if unknown?
    const age_group = getAgeGroup(age);
    
    let country_id = 'Unknown';
    let country_probability = 0;
    if (nData.country && nData.country.length > 0) {
      const topCountry = nData.country.reduce((max: any, c: any) =>
        c.probability > max.probability ? c : max
      );
      country_id = topCountry.country_id;
      country_probability = topCountry.probability;
    }

    const created_at = new Date().toISOString();

    db.run(
      `INSERT INTO profiles (id, name, name_lower, gender, probability, count, age, age_group, country_id, country_probability, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cleanName, nameLower, gender, probability, count, age, age_group, country_id, country_probability, created_at]
    );

    try {
      saveDb();
    } catch (saveErr: any) {
      console.error('Failed to save database:', saveErr);
      return res.status(500).json({ status: 'error', message: 'Failed to persist data' });
    }

    return res.status(201).json({
      status: 'success',
      data: {
        id, name: cleanName, gender, probability, count,
        age, age_group, country_id, country_probability, created_at
      }
    });

  } catch (err: any) {
    console.error('Error in POST /profiles:', err.message || err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.get('/profiles/:id', async (req: Request, res: Response) => {
  const db = await getDb();
  const rows = db.exec(
    'SELECT id, name, gender, probability, count, age, age_group, country_id, country_probability, created_at FROM profiles WHERE id = ?',
    [req.params.id]
  );

  if (rows.length === 0 || rows[0].values.length === 0) {
    return res.status(404).json({ status: 'error', message: 'Profile not found' });
  }

  const cols = rows[0].columns;
  const vals = rows[0].values[0];
  const profile: any = {};
  cols.forEach((col: string, i: number) => { profile[col] = vals[i]; });

  res.json({ status: 'success', data: profile });
});

router.get('/profiles', async (req: Request, res: Response) => {
  const db = await getDb();
  const { gender, country_id, age_group } = req.query;

  let query = 'SELECT id, name, gender, age, age_group, country_id FROM profiles WHERE 1=1';
  const params: any[] = [];

  if (gender) {
    query += ' AND LOWER(gender) = LOWER(?)';
    params.push(gender as string);
  }
  if (country_id) {
    query += ' AND LOWER(country_id) = LOWER(?)';
    params.push(country_id as string);
  }
  if (age_group) {
    query += ' AND LOWER(age_group) = LOWER(?)';
    params.push(age_group as string);
  }

  const result = db.exec(query, params);
  if (result.length === 0) {
    return res.json({ status: 'success', count: 0, data: [] });
  }

  const cols = result[0].columns;
  const data = result[0].values.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });

  res.json({ status: 'success', count: data.length, data });
});

router.delete('/profiles/:id', async (req: Request, res: Response) => {
  const db = await getDb();

  // Check existence first
  const existing = db.exec('SELECT id FROM profiles WHERE id = ?', [req.params.id]);
  if (existing.length === 0 || existing[0].values.length === 0) {
    return res.status(404).json({ status: 'error', message: 'Profile not found' });
  }

  db.run('DELETE FROM profiles WHERE id = ?', [req.params.id]);
  saveDb();
  res.status(204).send();
});

export default router;