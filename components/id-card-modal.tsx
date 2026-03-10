'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, RotateCcw, Pencil, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { updateNepaliFields } from '@/app/actions/subscriber';
import type { Subscriber } from '@/lib/types';

/** Convert English digits (0-9) to Nepali/Devanagari digits (०-९) */
function toNepaliDigits(str: string): string {
  const nepaliDigits = ['०','१','२','३','४','५','६','७','८','९'];
  return str.replace(/[0-9]/g, d => nepaliDigits[parseInt(d)]);
}

/** Simple English → Devanagari phonetic transliteration */
function transliterateToNepali(text: string): string {
  return text.split(/(\s+)/).map(word => {
    if (/^\s+$/.test(word)) return word;
    return transliterateWord(word);
  }).join('');
}

function transliterateWord(word: string): string {
  const vowelMap: Record<string, string> = {
    'aa': 'ा', 'ee': 'ी', 'oo': 'ू', 'ai': 'ै', 'au': 'ौ',
    'ei': 'ै', 'ou': 'ौ',
    'a': 'ा', 'e': 'े', 'i': 'ि', 'o': 'ो', 'u': 'ु',
  };
  const consonantMap: Record<string, string> = {
    'bh': 'भ', 'ch': 'छ', 'dh': 'ध', 'gh': 'घ', 'jh': 'झ',
    'kh': 'ख', 'ng': 'ङ', 'ph': 'फ', 'sh': 'श', 'th': 'थ',
    'tr': 'त्र', 'gn': 'ग्न', 'ny': 'ञ',
    'b': 'ब', 'c': 'क', 'd': 'ड', 'f': 'फ', 'g': 'ग',
    'h': 'ह', 'j': 'ज', 'k': 'क', 'l': 'ल', 'm': 'म',
    'n': 'न', 'p': 'प', 'q': 'क', 'r': 'र', 's': 'स',
    't': 'त', 'v': 'व', 'w': 'व', 'x': 'क्स', 'y': 'य', 'z': 'ज',
  };

  const lower = word.toLowerCase();
  let result = '';
  let i = 0;

  while (i < lower.length) {
    let consonant: string | null = null;
    if (i + 1 < lower.length && consonantMap[lower.substring(i, i + 2)]) {
      consonant = consonantMap[lower.substring(i, i + 2)];
      i += 2;
    } else if (consonantMap[lower[i]]) {
      consonant = consonantMap[lower[i]];
      i += 1;
    }

    if (consonant) {
      let vowel: string | null = null;
      if (i + 1 < lower.length && vowelMap[lower.substring(i, i + 2)]) {
        vowel = vowelMap[lower.substring(i, i + 2)];
        i += 2;
      } else if (i < lower.length && vowelMap[lower[i]]) {
        vowel = vowelMap[lower[i]];
        i += 1;
      }

      if (vowel) {
        result += consonant + vowel;
      } else {
        const nextIsConsonant = i < lower.length && (consonantMap[lower[i]] || (i + 1 < lower.length && consonantMap[lower.substring(i, i + 2)]));
        const atEnd = i >= lower.length;
        if (atEnd || nextIsConsonant) {
          result += consonant + '्';
        } else {
          result += consonant;
        }
      }
    } else {
      const fullVowelMap: Record<string, string> = {
        'aa': 'आ', 'ee': 'ई', 'oo': 'ऊ', 'ai': 'ऐ', 'au': 'औ',
        'ei': 'ऐ', 'ou': 'औ',
        'a': 'अ', 'e': 'ए', 'i': 'इ', 'o': 'ओ', 'u': 'उ',
      };
      let found = false;
      if (i + 1 < lower.length && fullVowelMap[lower.substring(i, i + 2)]) {
        result += fullVowelMap[lower.substring(i, i + 2)];
        i += 2;
        found = true;
      } else if (fullVowelMap[lower[i]]) {
        result += fullVowelMap[lower[i]];
        i += 1;
        found = true;
      }
      if (!found) {
        result += lower[i];
        i += 1;
      }
    }
  }

  return result;
}

interface IdCardModalProps {
  subscriber: Subscriber;
  open: boolean;
  onClose: () => void;
}

export function IdCardModal({ subscriber, open, onClose }: IdCardModalProps) {
  const [showBack, setShowBack] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Editable Nepali fields — read from DB, fall back to client-side transliteration
  const [nepaliName, setNepaliName] = useState(() =>
    subscriber.nepali_name || transliterateToNepali(subscriber.full_name)
  );
  const [nepaliPhone, setNepaliPhone] = useState(() =>
    subscriber.nepali_phone || (subscriber.phone ? toNepaliDigits(subscriber.phone) : '')
  );

  // Re-sync when subscriber prop changes (e.g. after page revalidation)
  useEffect(() => {
    setNepaliName(subscriber.nepali_name || transliterateToNepali(subscriber.full_name));
    setNepaliPhone(subscriber.nepali_phone || (subscriber.phone ? toNepaliDigits(subscriber.phone) : ''));
  }, [subscriber.nepali_name, subscriber.nepali_phone, subscriber.full_name, subscriber.phone]);

  // Save edits to DB when done editing
  const handleDoneEditing = useCallback(async () => {
    setSaving(true);
    try {
      const result = await updateNepaliFields(
        subscriber.id,
        nepaliName,
        nepaliPhone || null
      );
      if (result.success) {
        toast.success('Nepali details saved');
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to save Nepali details');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [subscriber.id, nepaliName, nepaliPhone]);

  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/subscribers/${subscriber.id}`
    : `/subscribers/${subscriber.id}`;

  const handlePrint = () => {
    if (!printRef.current) return;

    // Convert all canvas elements to img elements for print
    const clone = printRef.current.cloneNode(true) as HTMLDivElement;
    const canvases = printRef.current.querySelectorAll('canvas');
    const clonedCanvases = clone.querySelectorAll('canvas');
    canvases.forEach((canvas, i) => {
      try {
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.style.width = canvas.style.width || `${canvas.width}px`;
        img.style.height = canvas.style.height || `${canvas.height}px`;
        clonedCanvases[i].parentNode?.replaceChild(img, clonedCanvases[i]);
      } catch { /* ignore */ }
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ID Card - ${subscriber.full_name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: white;
          }
          .print-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 28px;
            padding: 20px;
          }
          @media print {
            body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-container {
              gap: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${clone.innerHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border-slate-200 max-w-[580px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-slate-900 text-lg font-bold">
            ID Card — {subscriber.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-5 space-y-4">
          {/* Editable Nepali fields */}
          {editing && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Edit Nepali Details</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">नाम (Nepali Name)</label>
                  <input
                    type="text"
                    value={nepaliName}
                    onChange={(e) => setNepaliName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
                {subscriber.phone && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">फोन (Nepali Phone)</label>
                    <input
                      type="text"
                      value={nepaliPhone}
                      onChange={(e) => setNepaliPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card display */}
          <div className="flex justify-center">
            <div
              className="relative cursor-pointer select-none transition-transform duration-500 ease-in-out"
              style={{ perspective: '1200px', width: '100%', maxWidth: '500px' }}
              onClick={() => setShowBack(!showBack)}
            >
              <div
                className="relative w-full transition-transform duration-500"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: showBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Front */}
                <div
                  className="w-full"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <IdCardFront subscriber={subscriber} profileUrl={profileUrl} />
                </div>

                {/* Back */}
                <div
                  className="w-full absolute top-0 left-0"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <IdCardBack subscriber={subscriber} profileUrl={profileUrl} nepaliName={nepaliName} nepaliPhone={nepaliPhone} />
                </div>
              </div>
            </div>
          </div>

          {/* Hint */}
          <p className="text-xs text-center text-slate-400">
            Click the card to flip it
          </p>

          {/* Actions */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => editing ? handleDoneEditing() : setEditing(true)}
              disabled={saving}
              className={`h-9 px-4 text-sm border-slate-200 ${editing ? 'text-amber-600 border-amber-300 bg-amber-50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : editing ? (
                <Check className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
              )}
              {saving ? 'Saving...' : editing ? 'Save' : 'Edit'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBack(!showBack)}
              className="h-9 px-4 text-sm border-slate-200 text-slate-500 hover:text-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Flip Card
            </Button>
            <Button
              onClick={handlePrint}
              className="h-9 px-4 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-md shadow-blue-600/25"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print
            </Button>
          </div>
        </div>

        {/* Hidden print container with both sides */}
        <div ref={printRef} className="hidden">
          <IdCardFront subscriber={subscriber} profileUrl={profileUrl} forPrint />
          <IdCardBack subscriber={subscriber} profileUrl={profileUrl} forPrint nepaliName={nepaliName} nepaliPhone={nepaliPhone} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Watermark (uses <img> so it works in print) ─── */
function TempleWatermark() {
  return (
    <img
      src="/trigajur_drawing.png"
      alt=""
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80%',
        height: '90%',
        objectFit: 'contain',
        opacity: 0.35,
        pointerEvents: 'none',
      }}
    />
  );
}

/* ─── Front (English) ─── */
function IdCardFront({ subscriber, profileUrl, forPrint }: {
  subscriber: Subscriber;
  profileUrl: string;
  forPrint?: boolean;
}) {
  return (
    <div
      style={{
        width: forPrint ? '4.5in' : '100%',
        aspectRatio: '3.375 / 2.25',
        background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)',
        borderRadius: forPrint ? '12px' : '16px',
        border: '1px solid #e2e8f0',
        boxShadow: forPrint ? 'none' : '0 4px 20px rgba(0,0,0,0.08)',
        padding: forPrint ? '14px 18px' : '18px 22px',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        overflow: 'hidden',
        position: 'relative' as const,
      }}
    >
      {/* Decorative accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: 'linear-gradient(90deg, #2196F3, #1976D2, #F57C00)',
      }} />

      {/* Temple watermark */}
      <TempleWatermark />

      {/* Header: Logo + Title + Subheading (centered) */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', marginTop: '4px', position: 'relative' as const, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/oaf-logo.png"
            alt="OAF Logo"
            style={{
              width: forPrint ? '60px' : '68px',
              height: forPrint ? '60px' : '68px',
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' as const }}>
            <span style={{
              fontSize: forPrint ? '24px' : '28px',
              fontWeight: 900,
              color: '#F57C00',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}>OM ADI FOUNDATION</span>
            <span style={{
              fontSize: forPrint ? '11px' : '12px',
              fontWeight: 800,
              color: '#1565C0',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              marginTop: '2px',
            }}>TRIGAJUR SHIVALAYA MANDIR SEWA</span>
          </div>
        </div>
      </div>

      {/* Details + QR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1, marginTop: '10px', position: 'relative' as const, zIndex: 1 }}>
        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px', minWidth: 0, flex: 1 }}>
          <DetailRow label="NAME" value={subscriber.full_name} forPrint={forPrint} />
          <DetailRow label="MASTER ID" value={subscriber.master_id} forPrint={forPrint} highlight />
          {subscriber.phone && <DetailRow label="PHONE" value={subscriber.phone} forPrint={forPrint} />}
          {subscriber.email && <DetailRow label="EMAIL" value={subscriber.email} forPrint={forPrint} />}
        </div>

        {/* QR */}
        <div style={{ flexShrink: 0, marginLeft: '12px' }}>
          <QRWithLogo url={profileUrl} size={forPrint ? 110 : 120} />
        </div>
      </div>

      {/* Foundation Contact Info */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        paddingTop: '6px',
        marginTop: '10px',
        display: 'flex',
        flexWrap: 'wrap' as const,
        justifyContent: 'center',
        gap: forPrint ? '6px 12px' : '4px 14px',
        position: 'relative' as const,
        zIndex: 1,
      }}>
        <span style={{ fontSize: forPrint ? '9px' : '10px', color: '#475569', fontWeight: 600 }}>
          Phone: 014114885
        </span>
        <span style={{ fontSize: forPrint ? '9px' : '10px', color: '#475569', fontWeight: 600 }}>
          WhatsApp: 9851313480 / 9851355002
        </span>
        <span style={{ fontSize: forPrint ? '9px' : '10px', color: '#475569', fontWeight: 600 }}>
          Email: trigajur2076@gmail.com
        </span>
      </div>
    </div>
  );
}

/* ─── Back (Nepali) ─── */
function IdCardBack({ subscriber, profileUrl, forPrint, nepaliName, nepaliPhone }: {
  subscriber: Subscriber;
  profileUrl: string;
  forPrint?: boolean;
  nepaliName: string;
  nepaliPhone: string;
}) {
  return (
    <div
      style={{
        width: forPrint ? '4.5in' : '100%',
        aspectRatio: '3.375 / 2.25',
        background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)',
        borderRadius: forPrint ? '12px' : '16px',
        border: '1px solid #e2e8f0',
        boxShadow: forPrint ? 'none' : '0 4px 20px rgba(0,0,0,0.08)',
        padding: forPrint ? '14px 18px' : '18px 22px',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        overflow: 'hidden',
        position: 'relative' as const,
      }}
    >
      {/* Decorative accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: 'linear-gradient(90deg, #F57C00, #1976D2, #2196F3)',
      }} />

      {/* Temple watermark */}
      <TempleWatermark />

      {/* Header: Logo + Nepali Title + Subheading (centered) */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', marginTop: '4px', position: 'relative' as const, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/oaf-logo.png"
            alt="OAF Logo"
            style={{
              width: forPrint ? '60px' : '68px',
              height: forPrint ? '60px' : '68px',
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' as const }}>
            <span style={{
              fontSize: forPrint ? '26px' : '30px',
              fontWeight: 900,
              color: '#F57C00',
              lineHeight: 1.15,
            }}>ॐ आदि फाउन्डेसन</span>
            <span style={{
              fontSize: forPrint ? '12px' : '15px',
              fontWeight: 800,
              color: '#1565C0',
              letterSpacing: '0.02em',
              marginTop: '2px',
            }}>त्रिगजुर शिवालय मन्दिर सेवा</span>
          </div>
        </div>
      </div>

      {/* Details + QR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1, marginTop: '10px', position: 'relative' as const, zIndex: 1 }}>
        {/* Details in Nepali labels, editable values */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px', minWidth: 0, flex: 1 }}>
          <DetailRow label="नाम" value={nepaliName} forPrint={forPrint} nepali />
          <DetailRow label="मास्टर आईडी" value={subscriber.master_id} forPrint={forPrint} highlight nepali />
          {subscriber.phone && <DetailRow label="फोन" value={nepaliPhone} forPrint={forPrint} nepali />}
          {subscriber.email && <DetailRow label="इमेल" value={subscriber.email} forPrint={forPrint} nepali />}
        </div>

        {/* QR */}
        <div style={{ flexShrink: 0, marginLeft: '12px' }}>
          <QRWithLogo url={profileUrl} size={forPrint ? 110 : 120} />
        </div>
      </div>

      {/* Foundation Contact Info (Nepali) */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        paddingTop: '6px',
        marginTop: '10px',
        display: 'flex',
        flexWrap: 'wrap' as const,
        justifyContent: 'center',
        gap: forPrint ? '6px 12px' : '4px 14px',
        position: 'relative' as const,
        zIndex: 1,
      }}>
        <span style={{ fontSize: forPrint ? '9px' : '10px', color: '#475569', fontWeight: 600 }}>
          फोन नम्बर: ०१-४११४८८५
        </span>
        <span style={{ fontSize: forPrint ? '9px' : '10px', color: '#475569', fontWeight: 600 }}>
          WhatsApp: ९८५१३१३४८० / ९८५१३५५००२
        </span>
        <span style={{ fontSize: forPrint ? '9px' : '10px', color: '#475569', fontWeight: 600 }}>
          इमेल: trigajur2076@gmail.com
        </span>
      </div>
    </div>
  );
}

/* ─── Detail Row ─── */
function DetailRow({ label, value, forPrint, highlight, nepali }: {
  label: string;
  value: string;
  forPrint?: boolean;
  highlight?: boolean;
  nepali?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', overflow: 'hidden' }}>
      <span style={{
        fontSize: forPrint ? '10px' : '11px',
        fontWeight: 800,
        color: '#1565C0',
        letterSpacing: nepali ? '0.01em' : '0.06em',
        textTransform: nepali ? 'none' as const : 'uppercase' as const,
        whiteSpace: 'nowrap' as const,
        flexShrink: 0,
      }}>
        {label}:
      </span>
      <span style={{
        fontSize: forPrint ? '12px' : '13px',
        fontWeight: highlight ? 800 : 600,
        color: highlight ? '#F57C00' : '#334155',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
      }}>
        {value}
      </span>
    </div>
  );
}

/* ─── QR Code with Logo Overlay ─── */
function QRWithLogo({ url, size }: { url: string; size: number }) {
  const logoSize = Math.round(size * 0.26);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <QRCodeCanvas
        value={url}
        size={size}
        level="H"
        marginSize={1}
        style={{ width: '100%', height: '100%' }}
      />
      {/* Centered circular logo */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: logoSize,
        height: logoSize,
        borderRadius: '50%',
        background: 'white',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img
          src="/oaf-logo.png"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      </div>
    </div>
  );
}
