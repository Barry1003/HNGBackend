import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import profilesRouter from './routes/profiles.js';

const app = express();
const PORT = process.env.PORT || 3000;

// required for grading
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api', profilesRouter);

app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`server is running on port: ${PORT}`);
});