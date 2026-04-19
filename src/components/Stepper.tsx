import type { AppStep } from "../types";

interface StepperProps {
  currentStep: AppStep;
  onStepClick: (step: AppStep) => void;
  /** When set, Browse (2) can jump to Edit routes (3) without regenerating a plan. */
  canOpenRouteEditor?: boolean;
  /** After the route was locked once, Browse (2) can jump to Track & export (4). */
  canOpenTrackFromBrowse?: boolean;
  className?: string;
}

const STEPS: { step: AppStep; label: string }[] = [
  { step: 1, label: "Preferences" },
  { step: 2, label: "Browse & Rate" },
  { step: 3, label: "Edit routes" },
  { step: 4, label: "Track & export" },
];

export function Stepper({
  currentStep,
  onStepClick,
  canOpenRouteEditor = false,
  canOpenTrackFromBrowse = false,
  className = "",
}: StepperProps) {
  return (
    <nav
      className={`flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 py-4 bg-white shadow-sm px-2 ${className}`}
    >
      {STEPS.map(({ step, label }) => {
        const isPast = step < currentStep;
        const isActive = step === currentStep;
        const openEditorFromBrowse = canOpenRouteEditor && currentStep === 2 && step === 3;
        const openTrackFromBrowse = canOpenTrackFromBrowse && currentStep === 2 && step === 4;
        const isClickable = isPast || openEditorFromBrowse || openTrackFromBrowse;

        let circleClass =
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-gray-300 text-gray-400";
        if (isActive) circleClass = "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-orange-600 text-white";
        else if (isPast) circleClass = "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-green-600 text-white";
        else if (openEditorFromBrowse || openTrackFromBrowse)
          circleClass =
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-orange-500 text-orange-700 bg-orange-50";

        return (
          <button
            key={step}
            type="button"
            onClick={() => isClickable && onStepClick(step)}
            className={`flex items-center gap-2 text-sm font-medium ${
              isActive
                ? "text-orange-600"
                : isPast
                  ? "text-green-600 cursor-pointer"
                  : openEditorFromBrowse || openTrackFromBrowse
                    ? "text-orange-800 cursor-pointer"
                    : "text-gray-400"
            }`}
          >
            <span className={circleClass}>{step}</span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
