import { useState, useCallback, useRef, useEffect } from 'react';
import { WorkHoursReport } from '../types/report';
import { reportService } from '../services/report.service';

export function useReports(initialFrom: string, initialTo: string) {
  const [report, setReport] = useState<WorkHoursReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [csvDownloading, setCsvDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const latestRequestIdRef = useRef(0);
  const isDownloadingRef = useRef(false);

  const fetchReport = useCallback(async (fromStr: string, toStr: string) => {
    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const data = await reportService.getWorkHoursReport(fromStr, toStr);
      if (requestId === latestRequestIdRef.current) {
        setReport(data);
      }
    } catch (err: any) {
      if (requestId === latestRequestIdRef.current) {
        const msg = err.response?.data?.message || 'Erro ao carregar relatório.';
        setError(msg);
      }
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const downloadCsv = useCallback(async (fromStr: string, toStr: string) => {
    if (isDownloadingRef.current) return;
    isDownloadingRef.current = true;
    setCsvDownloading(true);

    try {
      await reportService.downloadWorkHoursCsv(fromStr, toStr);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao baixar CSV.';
      setError(msg);
    } finally {
      isDownloadingRef.current = false;
      setCsvDownloading(false);
    }
  }, []);

  // Exactly 1 initial GET request when hook mounts
  useEffect(() => {
    fetchReport(initialFrom, initialTo);
  }, [initialFrom, initialTo, fetchReport]);

  return {
    report,
    loading,
    csvDownloading,
    error,
    setError,
    fetchReport,
    downloadCsv,
  };
}
