import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getDb, saveDb } from '../db.js';
import { v7 as uuidv7 } from 'uuid';
import { getAgeGroup } from '../utils/classify.js';

const router = Router();

router.get('/classify', async (req: Request, res: Response) => {
  try {
    const { name } = req.query;

    if (!name || (name as string).trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Missing or empty name parameter'
      });
    }

    const cleanName = (name as string).trim();
    const response = await axios.get(`https://api.genderize.io?name=${encodeURIComponent(cleanName)}`);
    const data = response.data;

    if (!data.gender || data.count === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No prediction available for the provided name',
      });
    }

    const probability = data.probability;
    const sample_size = data.count;
    const is_confident = probability >= 0.7 && sample_size >= 100;
    const processed_at = new Date().toISOString();

    return res.status(200).json({
      status: 'success',
      data: {
        name: data.name,
        gender: data.gender,
        probability,
        sample_size,
        is_confident,
        processed_at,
      }
    });
  } catch (err: any) {
    if (err.response) {
      return res.status(502).json({ status: 'error', message: 'Upstream service error' });
    } else if (err.request) {
      return res.status(502).json({ status: 'error', message: 'Upstream service unavailable' });
    } else {
      return res.status(500).json({ status: 'error', message: 'Something went wrong' });
    }
  }
});

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

    const existingRows = db.exec('SELECT id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at FROM profiles WHERE name_lower = ?', [nameLower]);
    if (existingRows.length > 0 && existingRows[0].values.length > 0) {
      const cols = existingRows[0].columns;
      const vals = existingRows[0].values[0];
      const existing: any = {};
      cols.forEach((col: string, i: number) => { existing[col] = vals[i]; });
      return res.status(201).json({
        status: 'success',
        message: 'Profile already exists',
        data: existing
      });
    }

    let gData: any, aData: any, nData: any;
    try {
      const [gRes, aRes, nRes] = await Promise.all([
        axios.get(`https://api.genderize.io?name=${encodeURIComponent(cleanName)}`),
        axios.get(`https://api.agify.io?name=${encodeURIComponent(cleanName)}`),
        axios.get(`https://api.nationalize.io?name=${encodeURIComponent(cleanName)}`)
      ]);
      gData = gRes.data;
      aData = aRes.data;
      nData = nRes.data;
    } catch (err: any) {
      return res.status(502).json({ status: 'error', message: 'Upstream service error' });
    }

    if (!gData.gender || gData.count === 0) {
      return res.status(502).json({ status: 'error', message: 'Genderize returned an invalid response' });
    }
    if (aData.age === null || aData.age === undefined) {
      return res.status(502).json({ status: 'error', message: 'Agify returned an invalid response' });
    }
    if (!nData.country || nData.country.length === 0) {
      return res.status(502).json({ status: 'error', message: 'Nationalize returned an invalid response' });
    }

    const topCountry = nData.country.reduce((max: any, c: any) =>
      c.probability > max.probability ? c : max
    );

    const id = uuidv7();
    const gender = gData.gender;
    const gender_probability = gData.probability;
    const sample_size = gData.count;
    const age = aData.age;
    const age_group = getAgeGroup(age);
    const country_id = topCountry.country_id;
    const country_probability = topCountry.probability;
    const created_at = new Date().toISOString();

    db.run(
      `INSERT INTO profiles (id, name, name_lower, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cleanName, nameLower, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at]
    );

    saveDb();

    return res.status(201).json({
      status: 'success',
      data: {
        id, name: cleanName, gender, gender_probability, sample_size,
        age, age_group, country_id, country_probability, created_at
      }
    });

  } catch (err: any) {
    console.error('Error in POST /profiles:', err.message || err);
    return res.status(500).json({ status: 'error', message: 'Something went wrong' });
  }
});

router.get('/profiles/:id', async (req: Request, res: Response) => {
  const db = await getDb();
  const rows = db.exec(
    'SELECT id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at FROM profiles WHERE id = ?',
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