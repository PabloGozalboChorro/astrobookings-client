import { bookabilityReasonText, type BookabilityReason } from '../../domain/launch';

type BookabilityNoticeProps = {
  reason: BookabilityReason;
};

export function BookabilityNotice({ reason }: BookabilityNoticeProps) {
  return <p className="bookability-notice">{bookabilityReasonText(reason)}</p>;
}
