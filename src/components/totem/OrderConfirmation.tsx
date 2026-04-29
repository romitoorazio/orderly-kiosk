import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Order } from '@/lib/constants';
import { BUSINESS } from '@/config/business';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { getOrderNumber, hasPhysicalBeeper } from '@/lib/orderDisplay';

interface OrderConfirmationProps {
  order: Order;
  logoError: boolean;
  onLogoError: () => void;
  onDismiss: () => void;
}

const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  order,
  logoError,
  onLogoError,
  onDismiss,
}) => {
  const { flags } = useFeatureFlags();
  const orderNumber = getOrderNumber(order);
  const showBeeper = flags.beepers.enabled && hasPhysicalBeeper(order, flags.beepers);

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center animate-fade-in"
      onClick={onDismiss}
    >
      {/* Success animation */}
      <div className="animate-bounce-in mb-8">
        <div className="w-32 h-32 rounded-full kiosk-gradient-green flex items-center justify-center kiosk-shadow">
          <CheckCircle2 size={64} className="text-accent-foreground" />
        </div>
      </div>

      <h1 className="text-4xl md:text-6xl font-black text-foreground mb-4 animate-slide-up">
        ORDINE CONFERMATO!
      </h1>

      <div className="animate-scale-in">
        <div className="kiosk-gradient rounded-3xl px-12 py-8 kiosk-shadow kiosk-glow">
          <p className="text-center text-primary-foreground font-bold text-lg mb-1">
            {showBeeper ? "IL TUO BEEPER" : "IL TUO NUMERO"}
          </p>
          <p className="text-center text-8xl md:text-9xl font-black text-primary-foreground">
            {orderNumber}
          </p>
        </div>
      </div>

      {!showBeeper && flags.beepers.fallbackText && (
        <p className="mt-6 text-lg text-muted-foreground font-bold text-center max-w-xl animate-fade-in">
          {flags.beepers.fallbackText}
        </p>
      )}

      <p className="mt-8 text-xl text-muted-foreground font-medium animate-fade-in">
        {order.type === 'card' ? '💳 Pagamento con carta effettuato' : '💰 Paga alla cassa'}
      </p>

      <p className="mt-2 text-base text-muted-foreground/60">
        Totale: €{Number(order.total).toFixed(2)}
      </p>

      {/* Print area (hidden on screen) */}
      <div className="print-area hidden print:block">
        <div className="text-center p-2">
          <p className="text-lg font-bold">{BUSINESS.texts.welcomeFooter}</p>
          <hr className="my-2" />
          <p className="text-sm">ORDINE N.</p>
          <p className="text-6xl font-black">{orderNumber}</p>
          <hr className="my-2" />

          {order.items?.map((item, i) => (
            <div key={i} className="text-left text-xs border-b py-1">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span className="float-right">
                €{(item.price * item.quantity).toFixed(2)}
              </span>
              {item.customization?.length > 0 && (
                <div className="text-[10px]">+ {item.customization.join(', ')}</div>
              )}
            </div>
          ))}

          <div className="mt-2 text-right font-bold">
            TOTALE: €{Number(order.total).toFixed(2)}
          </div>

          <p className="mt-2 text-xs">
            {order.type === 'card' ? 'PAGATO CON CARTA' : 'DA PAGARE ALLA CASSA'}
          </p>

          <p className="text-[8px] mt-4">Grazie e buon appetito!</p>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;