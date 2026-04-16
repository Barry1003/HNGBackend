import axios, { AxiosResponse } from 'axios';

const BASE_URL = 'http://localhost:3000/api';
const TEST_NAME = `testuser_${Date.now()}`; // unique each run
let createdId: string | null = null;

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, info?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`, info !== undefined ? JSON.stringify(info, null, 2) : '');
    failed++;
  }
}

async function req(method: string, url: string, body?: any, expectedStatus?: number): Promise<AxiosResponse | null> {
  try {
    const res = await axios({ method, url, data: body, validateStatus: () => true });
    if (expectedStatus !== undefined) {
      assert(`Status code is ${expectedStatus}`, res.status === expectedStatus, { got: res.status, body: res.data });
    }
    return res;
  } catch (e: any) {
    console.error(`  ❌ REQUEST FAILED: ${method} ${url}`, e.message);
    failed++;
    return null;
  }
}

function isUUIDv7(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function isISO8601UTC(ts: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(ts);
}

(async () => {
  console.log('\n==================================================');
  console.log('  HNG Stage 1 Backend - Full API Test Suite');
  console.log('==================================================\n');
  console.log(`Using test name: "${TEST_NAME}"\n`);

  // --- POST /api/profiles (Create Profile) ---
  console.log('📋 POST /api/profiles (Create Profile)');

  // Test missing name (no body)
  {
    const res = await req('POST', `${BASE_URL}/profiles`, {}, 400);
    if (res) {
      assert('400 on missing name - status', res.data.status === 'error');
      assert('400 on missing name - message exists', !!res.data.message);
    }
  }

  // Test empty string name
  {
    const res = await req('POST', `${BASE_URL}/profiles`, { name: '   ' }, 400);
    if (res) {
      assert('400 on empty/whitespace name - status', res.data.status === 'error');
    }
  }

  // Test invalid type
  {
    const res = await req('POST', `${BASE_URL}/profiles`, { name: 12345 }, 422);
    if (res) {
      assert('422 on invalid name type - status', res.data.status === 'error');
      assert('422 on invalid name type - message exists', !!res.data.message);
    }
  }

  // Test valid profile creation - use "james" which has valid external data
  {
    const res = await req('POST', `${BASE_URL}/profiles`, { name: 'james' });
    if (res && (res.status === 201 || (res.status === 200 && res.data?.message === 'Profile already exists'))) {
      const d = res.data;
      if (res.status === 201) {
        assert('201 - status is success', d.status === 'success');
        assert('201 - data object exists', !!d.data);
        assert('201 - id is UUID v7', d.data?.id && isUUIDv7(d.data.id), d.data?.id);
        assert('201 - name matches', d.data?.name?.toLowerCase() === 'james');
        assert('201 - gender present', !!d.data?.gender);
        assert('201 - gender_probability present', d.data?.gender_probability !== undefined);
        assert('201 - sample_size present', d.data?.sample_size !== undefined);
        assert('201 - age present', d.data?.age !== undefined);
        assert('201 - age_group is valid', ['child', 'teenager', 'adult', 'senior'].includes(d.data?.age_group));
        assert('201 - country_id present', !!d.data?.country_id);
        assert('201 - country_probability present', d.data?.country_probability !== undefined);
        assert('201 - created_at is ISO 8601 UTC', isISO8601UTC(d.data?.created_at));
      } else {
        assert('Profile create returns success (already exists)', d.status === 'success');
        console.log('  ℹ️  "james" already existed, using existing record');
      }
      createdId = d.data?.id ?? null;
    } else if (res) {
      assert('Profile create - expected 201 or 200', false, { status: res.status, body: res.data });
    }
  }

  // Test idempotency (same name again)
  {
    const res = await req('POST', `${BASE_URL}/profiles`, { name: 'james' });
    if (res) {
      assert('Idempotency - status is success', res.data.status === 'success');
      assert('Idempotency - message is "Profile already exists"', res.data.message === 'Profile already exists');
      assert('Idempotency - data exists', !!res.data.data);
      if (createdId) {
        assert('Idempotency - same id returned', res.data.data?.id === createdId);
      }
    }
  }

  // Test case-insensitivity for idempotency
  {
    const res = await req('POST', `${BASE_URL}/profiles`, { name: 'JAMES' });
    if (res) {
      assert('Idempotency - case insensitive (JAMES = james)', res.data.status === 'success' && res.data.message === 'Profile already exists');
    }
  }

  console.log('');

  // --- GET /api/profiles/:id ---
  console.log('📋 GET /api/profiles/:id');

  if (createdId) {
    const res = await req('GET', `${BASE_URL}/profiles/${createdId}`, undefined, 200);
    if (res) {
      assert('GET by ID - status', res.data.status === 'success');
      assert('GET by ID - data exists', !!res.data.data);
      assert('GET by ID - correct id', res.data.data?.id === createdId);
      const data = res.data.data;
      assert('GET by ID - all fields present', !!(
        data.name &&
        data.gender !== undefined &&
        data.gender_probability !== undefined &&
        data.sample_size !== undefined &&
        data.age !== undefined &&
        data.age_group &&
        data.country_id &&
        data.country_probability !== undefined &&
        data.created_at
      ));
    }
  } else {
    console.log('  ⚠️  Skipping GET by ID - no ID from create step');
  }

  {
    const res = await req('GET', `${BASE_URL}/profiles/00000000-0000-7000-8000-000000000000`, undefined, 404);
    if (res) {
      assert('GET by ID - 404 for missing id', res.data.status === 'error');
    }
  }

  console.log('');

  // --- GET /api/profiles ---
  console.log('📋 GET /api/profiles');

  {
    const res = await req('GET', `${BASE_URL}/profiles`, undefined, 200);
    if (res) {
      assert('GET all - status', res.data.status === 'success');
      assert('GET all - count field', typeof res.data.count === 'number');
      assert('GET all - data is array', Array.isArray(res.data.data));
      assert('GET all - count matches data length', res.data.count === res.data.data.length);
      if (res.data.data.length > 0) {
        const item = res.data.data[0];
        assert('GET all - profile has required fields', !!(
          item.id && item.name && item.gender !== undefined && item.age !== undefined &&
          item.age_group && item.country_id
        ));
      }
    }
  }

  // Filter by gender (case-insensitive)
  {
    const res = await req('GET', `${BASE_URL}/profiles?gender=male`, undefined, 200);
    if (res) {
      assert('Filter gender=male - status', res.data.status === 'success');
      const allMatch = res.data.data.every((p: any) => p.gender?.toLowerCase() === 'male');
      assert('Filter gender=male - all results match', allMatch, res.data.data.map((p:any) => p.gender));
    }
  }

  {
    const res = await req('GET', `${BASE_URL}/profiles?gender=Male`, undefined, 200);
    if (res) {
      assert('Filter gender=Male (case-insensitive) - status', res.data.status === 'success');
      const allMatch = res.data.data.every((p: any) => p.gender?.toLowerCase() === 'male');
      assert('Filter gender=Male (case-insensitive) - all results match', allMatch);
    }
  }

  {
    const res = await req('GET', `${BASE_URL}/profiles?age_group=adult`, undefined, 200);
    if (res) {
      assert('Filter age_group=adult - status', res.data.status === 'success');
      const allMatch = res.data.data.every((p: any) => p.age_group?.toLowerCase() === 'adult');
      assert('Filter age_group=adult - all match', allMatch);
    }
  }

  console.log('');

  // --- CORS Header ---
  console.log('📋 CORS: Access-Control-Allow-Origin Header');
  {
    const res = await req('GET', `${BASE_URL}/profiles`);
    if (res) {
      const corsHeader = res.headers['access-control-allow-origin'];
      assert('CORS header is *', corsHeader === '*', { header: corsHeader });
    }
  }

  console.log('');

  // --- DELETE /api/profiles/:id ---
  console.log('📋 DELETE /api/profiles/:id');

  {
    const res = await req('DELETE', `${BASE_URL}/profiles/00000000-0000-7000-8000-000000000000`, undefined, 404);
    if (res) {
      assert('DELETE 404 for missing id', res.data.status === 'error');
    }
  }

  // Use 'michael' (valid external API data) for DELETE test
  // If already exists, delete it first so we can re-create fresh
  {
    const existRes = await req('POST', `${BASE_URL}/profiles`, { name: 'michael' });
    if (existRes?.data?.data?.id) {
      await req('DELETE', `${BASE_URL}/profiles/${existRes.data.data.id}`);
    }
    // Now re-create fresh (michael was just deleted OR never existed)
    const createRes = await req('POST', `${BASE_URL}/profiles`, { name: 'michael' }, 201);
    if (createRes && createRes.status === 201) {
      const tempId = createRes.data.data?.id;
      if (tempId) {
        const deleteRes = await req('DELETE', `${BASE_URL}/profiles/${tempId}`, undefined, 204);
        if (deleteRes) {
          assert('DELETE 204 on success', deleteRes.status === 204);
        }
        const verifyRes = await req('GET', `${BASE_URL}/profiles/${tempId}`, undefined, 404);
        if (verifyRes) {
          assert('Verify deleted profile returns 404', verifyRes.status === 404);
        }
      }
    } else {
      console.log('  ⚠️  Skipping DELETE verification - profile creation failed');
    }
  }

  console.log('');
  console.log('==================================================');
  console.log(`  Results: ✅ ${passed} passed, ❌ ${failed} failed`);
  console.log('==================================================\n');

  if (failed > 0) process.exit(1);
})();
