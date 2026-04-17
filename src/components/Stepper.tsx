import type { AppStep } from "../types";

interface StepperProps {
  currentStep: AppStep;
  onStepClick: (step: AppStep) => void;
}

const STEPS: { step: AppStep; label: string }[] = [
  { step: 1, label: "Preferences" },
  { step: 2, label: "Browse & Rate" },
  { step: 3, label: "Your Routes" },
];

export function Stepper({ currentStep, onStepClick }: StepperProps) {
  // TODO: Implement a horizontal step indicator with clickable steps.
  // Steps before currentStep should look "completed" (filled circle, green).
  // Current step should look "active" (filled circle, orange).
  // Future steps should look "pending" (outline circle, gray).
  // Clicking a past step navigates back; clicking a future step does nothing.

  return (
    <nav className="flex justify-center gap-8 py-4 bg-white shadow-sm">
      {STEPS.map(({ step, label }) => (
        <button
          key={step}
          onClick={() => step < currentStep && onStepClick(step)}
          className={`flex items-center gap-2 text-sm font-medium ${
            step === currentStep
              ? "text-orange-600"
              : step < currentStep
                ? "text-green-600 cursor-pointer"
                : "text-gray-400"
          }`}
        >
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === currentStep
                ? "bg-orange-600 text-white"
                : step < currentStep
                  ? "bg-green-600 text-white"
                  : "border-2 border-gray-300 text-gray-400"
            }`}
          >
            {step}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}
