import type { Request, Response } from 'express';
import { deletePlan, createPlan, listPlans, updatePlan } from '../services/plansService';
import { HttpError } from '../services/projectsService';

function handleError(res: Response, error: unknown): boolean {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return true;
  }
  return false;
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Некорректный id задачи');
  return id;
}

export function plansController(req: Request, res: Response): void {
  try {
    res.json(
      listPlans(
        typeof req.query.projectSlug === 'string' ? req.query.projectSlug : undefined,
        typeof req.query.priority === 'string' ? (req.query.priority as never) : undefined,
      ),
    );
  } catch (error) {
    if (!handleError(res, error)) throw error;
  }
}

export function createPlanController(req: Request, res: Response): void {
  try {
    res.status(201).json(createPlan(req.body));
  } catch (error) {
    if (!handleError(res, error)) throw error;
  }
}

export function updatePlanController(req: Request, res: Response): void {
  try {
    res.json(updatePlan(parseId(String(req.params.id)), req.body));
  } catch (error) {
    if (!handleError(res, error)) throw error;
  }
}

export function deletePlanController(req: Request, res: Response): void {
  try {
    deletePlan(parseId(String(req.params.id)));
    res.status(204).end();
  } catch (error) {
    if (!handleError(res, error)) throw error;
  }
}
