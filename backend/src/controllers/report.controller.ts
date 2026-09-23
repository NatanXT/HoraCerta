import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/report.service';
import { validateReportQuery } from '../schemas/report.schema';
import { generateWorkHoursCsv } from '../utils/csv-serializer';

export class ReportController {
  async getWorkHoursReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = validateReportQuery(req.query);
      const report = await reportService.getWorkHoursReport(from, to);
      res.status(200).json(report);
    } catch (error) {
      next(error);
    }
  }

  async downloadWorkHoursCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = validateReportQuery(req.query);
      const report = await reportService.getWorkHoursReport(from, to);
      const csvContent = generateWorkHoursCsv(report);

      const filename = `horacerta-relatorio-${from}-a-${to}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
