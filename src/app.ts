import express from 'express';
import { identifyController } from './controllers/identify.controller';

const app = express();

app.use(express.json());
app.post('/identify', identifyController);

export default app;
