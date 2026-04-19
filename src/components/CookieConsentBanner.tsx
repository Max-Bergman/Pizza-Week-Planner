import type { StorageConsent } from "../lib/storageConsent";

interface CookieConsentBannerProps {
  /** When unknown, the dialog is shown. */
  consent: StorageConsent;
  onChoose: (choice: "accepted" | "declined") => void;
}

/**
 * This app does not use third‑party advertising cookies.
 * It uses browser local storage (similar to cookies for this choice) to remember your work.
 */
export function CookieConsentBanner({ consent, onChoose }: CookieConsentBannerProps) {
  if (consent !== "unknown") return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-200 shadow-2xl p-5 sm:p-6 text-left max-h-[90vh] overflow-y-auto">
        <h2 id="cookie-consent-title" className="text-lg font-bold text-gray-900">
          Storage on this site
        </h2>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          Portland Pizza Week Planner keeps your preferences, ratings, routes, and visit diary in{" "}
          <strong>your browser&apos;s local storage</strong> so they survive refresh and come back when you return.
          We do <strong>not</strong> use this for advertising, tracking, or selling data. There are no analytics or
          marketing cookies from us.
        </p>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Optional community highlights (if enabled by the site operator) use a separate anonymous id in the same
          storage so each browser can contribute at most once to shared totals—not for ads.
        </p>
        <div className="mt-5 rounded-xl bg-orange-50 border border-orange-100 p-3 text-sm text-orange-950">
          <p className="font-semibold">If you decline</p>
          <p className="mt-1 text-orange-900/90">
            Nothing is saved after you close the tab: no routes, ratings, or visit notes. You can still use the
            planner for this session, but your work will be lost when you leave or refresh.
          </p>
        </div>
        <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onChoose("declined")}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50"
          >
            Decline storage
          </button>
          <button
            type="button"
            onClick={() => onChoose("accepted")}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-semibold shadow-sm"
          >
            Accept (recommended)
          </button>
        </div>
      </div>
    </div>
  );
}
