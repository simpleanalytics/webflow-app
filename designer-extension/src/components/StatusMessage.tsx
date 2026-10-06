import { StatusInfo } from "../types/types";

interface StatusMessageProps {
  status: StatusInfo;
}

export function StatusMessage({ status }: StatusMessageProps) {
  if (!status.message || !status.type) {
    return null;
  }

  return <div className={`status ${status.type}`}>{status.message}</div>;
}
