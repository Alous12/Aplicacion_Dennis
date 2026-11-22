import serverless from 'serverless-http';
import { app } from '../../src/app';

// Netlify Function que expone toda la API Express bajo /api/*
export const handler = serverless(app);
