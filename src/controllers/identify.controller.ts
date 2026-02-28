import { Request, Response } from 'express';
import { IdentityService } from '../services/identity.service';

const service = new IdentityService();

export async function identifyController(req: Request, res: Response) {
  try {
    const result = await service.identify(req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Email or phoneNumber is required') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
