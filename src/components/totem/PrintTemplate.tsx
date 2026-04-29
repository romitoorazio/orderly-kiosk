import React from 'react';
import { LOGO_URL } from '@/lib/constants';
import { BUSINESS } from '@/config/business';
import { readGlobalBeeperConfig } from '@/lib/beeperConfig';
import { getOrderNumber, hasPhysicalBeeper } from '@/lib/orderDisplay';

interface PrintTemplateProps {
  order: any;
  isReprint?: boolean;
}

interface AggregatedItem {
  id: string;
  name: string;
  price: string | number;
  quantity?: number;
  printQuantity: number;
  customization?: any[];
  _cottura?: string;
}

// FIX DEFINITIVO INVALID DATE
const getSafeDate = (order: any) => {
  if (!order) return new Date();

  if (order.timestamp?.seconds) {
    return new Date(order.timestamp.seconds * 1000);
  }

  if (typeof order.timestamp?.toDate === 'function') {
    return order.timestamp.toDate();
  }

  if (order.clientTimestamp) {
    return new Date(order.clientTimestamp);
  }

  if (order.timestamp && (typeof order.timestamp === 'string' || typeof order.timestamp === 'number')) {
    const d = new Date(order.timestamp);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
};

const PrintTemplate: React.FC<PrintTemplateProps> = ({ order, isReprint }) => {
  if (!order) return null;

  const receiptWidthMm = Number(order?.receiptWidthMm || 72);
  const receiptWidth = `${receiptWidthMm}mm`;

  const aggregatedMap = (order.items || []).reduce((acc: Record<string, AggregatedItem>, item: any) => {
    const customizationKey = (item.customization || [])
      .map((c: any) => typeof c === 'object' ? c.name : c)
      .join(',');

    const key = `${item.id}|${customizationKey}|${item._cottura || ''}`;

    if (!acc[key]) {
      acc[key] = { ...item, printQuantity: 0 };
    }

    acc[key].printQuantity += item.quantity || 1;
    return acc;
  }, {});

  const aggregatedItems = Object.entries(aggregatedMap) as [string, AggregatedItem][];

  const beeperConfig = readGlobalBeeperConfig();
  const pickupText = !beeperConfig.enabled
    ? beeperConfig.fallbackText
    : hasPhysicalBeeper(order, beeperConfig)
      ? BUSINESS.texts.receiptPickupBeeper
      : (beeperConfig.fallbackText || BUSINESS.texts.receiptPickupMonitor);

  const paymentText =
    order.type === 'card' && !order.forcedCash
      ? BUSINESS.texts.receiptPaidByCard
      : BUSINESS.texts.receiptPayAtCash;

  return (
    <>
      <style>{`
        /* NASCONDE LO SCONTRINO NELLO SCHERMO NORMALE */
        .print-container {
          display: none;
        }

        /* METODO BLINDATO PER STAMPA TERMICA CHROME KIOSK */
        @media print {
          @page { margin: 0; size: ${receiptWidth} auto; }
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
            color: black !important;
          }
          .print-container {
            display: block;
            position: absolute;
            left: 4mm; /* Staccato dal bordo sinistro cieco */
            top: 0;
            width: ${receiptWidth}; /* A.2.3: formato ricevuta configurabile, default 72mm */
            margin: 0;
            padding: 0;
            font-family: monospace;
            font-size: 14px;
            background-color: white !important;
          }
          .logo-termico {
            max-width: 60%;
            height: auto;
            margin: 0 auto 10px auto;
            display: block;
            filter: grayscale(100%) contrast(200%);
          }
        }
      `}</style>

      <div className="print-container">
        <div style={{ textAlign: 'center', marginBottom: '5px' }}>
          <img
            src={LOGO_URL}
            alt={`Logo ${BUSINESS.name}`}
            className="logo-termico"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        <div style={{ borderBottom: '3px dashed black', margin: '10px 0' }}></div>

        <div style={{ textAlign: 'center', margin: '15px 0' }}>
          {(isReprint || order.isReprint) && (
            <div style={{ border: '4px solid black', padding: '5px', marginBottom: '15px', fontSize: '20px', fontWeight: '900', backgroundColor: '#f0f0f0' }}>
              RISTAMPA KIOSK
            </div>
          )}

          {(order.origine === 'qr' || order.isMobile) && (
            <div style={{ border: '6px solid black', backgroundColor: 'black', color: 'white', padding: '8px', marginBottom: '15px', fontSize: '22px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
              📱 ORDINE DA TAVOLO<br />(MOBILE / QR)
            </div>
          )}

          {order.forcedCash === true && (
            <div
              style={{
                border: '6px solid black',
                backgroundColor: 'black',
                color: 'white',
                padding: '8px',
                marginBottom: '15px',
                fontSize: '20px',
                fontWeight: '900',
                textTransform: 'uppercase',
              }}
            >
              ATTENZIONE!<br />INCASSARE CONTANTI
            </div>
          )}

          <p style={{ fontSize: '18px', fontWeight: '900', margin: '0', textTransform: 'uppercase' }}>
            {pickupText}
          </p>

          <h2 style={{ fontSize: '70px', fontWeight: '900', margin: '10px 0', lineHeight: '1' }}>
            #{getOrderNumber(order)}
          </h2>
        </div>

        <div style={{ borderBottom: '3px dashed black', margin: '10px 0' }}></div>

        <div style={{ marginBottom: '10px' }}>
          {aggregatedItems.map(([key, item]) => (
            <div key={key} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '16px', alignItems: 'flex-start', textTransform: 'uppercase' }}>
                <span style={{ flex: 1, paddingRight: '5px', wordBreak: 'break-word', lineHeight: '1.2' }}>
                  {item.printQuantity}x {item.name}
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>
                  € {(Number(item.price) * item.printQuantity).toFixed(2)}
                </span>
              </div>

              {item.customization && item.customization.length > 0 && (
                <div style={{ fontSize: '13px', paddingLeft: '10px', marginTop: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  * {item.customization.map((c: any) => typeof c === 'object' ? c.name : c).join(', ')}
                </div>
              )}

              {item._cottura && (
                <div style={{ fontSize: '13px', paddingLeft: '10px', marginTop: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  COTTURA: {item._cottura}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ borderBottom: '3px dashed black', margin: '10px 0' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: '900', marginTop: '10px', textTransform: 'uppercase' }}>
          <span>TOTALE:</span>
          <span>€ {Number(order.total).toFixed(2)}</span>
        </div>

        <div style={{ textAlign: 'center', margin: '20px 0', padding: '10px', border: '3px solid black', fontSize: '16px', fontWeight: '900', textTransform: 'uppercase' }}>
          {paymentText}
        </div>

        <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
          <p style={{ margin: '0' }}>{getSafeDate(order).toLocaleString(BUSINESS.locale)}</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '16px', fontWeight: '900' }}>
            {BUSINESS.texts.receiptThankYou}
          </p>
        </div>

        <div style={{ height: '170px' }}></div>

        <div style={{ textAlign: 'center', fontSize: '10px', color: '#999', textTransform: 'uppercase' }}>
          --- FINE SCONTRINO ---
        </div>

        <div style={{ height: '60px' }}>&nbsp;</div>
      </div>
    </>
  );
};

export default PrintTemplate;