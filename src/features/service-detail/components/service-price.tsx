import type { ServiceDetailPrice } from '../types';

type Props = {
  price: ServiceDetailPrice | null;
  fromLabel: string;
  unknownLabel: string;
};

export function ServicePrice({ price, fromLabel, unknownLabel }: Props) {
  if (!price) {
    return (
      <p className="text-lg font-semibold text-brand-text/70">
        {unknownLabel}
      </p>
    );
  }
  return (
    <p className="text-xl font-bold text-brand-text">
      <span className="text-base font-medium text-brand-text/70">
        {fromLabel}{' '}
      </span>
      {price.amount} {price.currency}
    </p>
  );
}
