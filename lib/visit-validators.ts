/**
 * Visit Data Validation Utilities
 * Ensures data integrity for visit records
 */

import type { Medicine, Visit } from "@/lib/types";

/**
 * Validates LMP (Last Menstrual Period) date
 * - Cannot be in the future
 * - Should be a valid date format
 */
export function validateLMP(lmp: string | undefined): { valid: boolean; error?: string } {
  if (!lmp) return { valid: true }; // LMP is optional

  try {
    const lmpDate = new Date(lmp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(lmpDate.getTime())) {
      return { valid: false, error: "Invalid LMP date format" };
    }

    if (lmpDate > today) {
      return { valid: false, error: "LMP cannot be in the future" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid LMP date" };
  }
}

/**
 * Calculates EDD (Expected Delivery Date) from LMP
 * EDD = LMP + 280 days (40 weeks)
 */
export function calculateEDD(lmp: string): string {
  const lmpDate = new Date(lmp);
  const eddDate = new Date(lmpDate);
  eddDate.setDate(eddDate.getDate() + 280);
  return eddDate.toISOString().split("T")[0];
}

/**
 * Validates a single medicine entry
 */
export function validateMedicine(medicine: Medicine): { valid: boolean; error?: string } {
  if (!medicine.name?.trim()) {
    return { valid: false, error: "Medicine name is required" };
  }

  if (!medicine.dosage?.trim()) {
    return { valid: false, error: "Medicine dosage is required" };
  }

  if (!medicine.frequency?.trim()) {
    return { valid: false, error: "Medicine frequency is required" };
  }

  if (!medicine.days || medicine.days <= 0) {
    return { valid: false, error: "Medicine duration must be greater than 0 days" };
  }

  return { valid: true };
}

/**
 * Validates all medicines in a prescription
 */
export function validateMedicines(medicines: Medicine[] | undefined): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!medicines || medicines.length === 0) {
    return { valid: true, errors }; // Medicines are optional
  }

  const medicineNames = new Set<string>();

  medicines.forEach((medicine, index) => {
    const validation = validateMedicine(medicine);
    if (!validation.valid) {
      errors.push(`Medicine ${index + 1}: ${validation.error}`);
    }

    // Check for duplicates
    const normalizedName = medicine.name?.toLowerCase().trim();
    if (normalizedName && medicineNames.has(normalizedName)) {
      errors.push(`Medicine ${index + 1}: Duplicate medicine "${medicine.name}"`);
    } else if (normalizedName) {
      medicineNames.add(normalizedName);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Validates follow-up date
 * - Should be a valid date
 * - Should be in the future
 */
export function validateFollowUpDate(followUpDate: string | undefined): { valid: boolean; error?: string } {
  if (!followUpDate) return { valid: true }; // Follow-up date is optional

  try {
    const followUpDateObj = new Date(followUpDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(followUpDateObj.getTime())) {
      return { valid: false, error: "Invalid follow-up date format" };
    }

    if (followUpDateObj < today) {
      return { valid: false, error: "Follow-up date must be in the future" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid follow-up date" };
  }
}

/**
 * Validates basic visit data
 */
export function validateVisitBasics(data: Partial<Visit>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.complaints?.trim()) {
    errors.push("Complaints are required");
  }

  if (!data.diagnosis?.trim()) {
    errors.push("Diagnosis is required");
  }

  if (data.totalBill !== undefined && (Number(data.totalBill) < 0 || !Number.isFinite(Number(data.totalBill)))) {
    errors.push("Total bill must be a valid non-negative amount");
  }

  const followUpValidation = validateFollowUpDate(data.followUpDate);
  if (!followUpValidation.valid) {
    errors.push(`Follow-up: ${followUpValidation.error}`);
  }

  const medicinesValidation = validateMedicines(data.prescriptions);
  if (!medicinesValidation.valid) {
    errors.push(...medicinesValidation.errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Checks if two medicine lists are identical
 */
export function areMedicinesIdentical(
  meds1: Medicine[] | undefined,
  meds2: Medicine[] | undefined
): boolean {
  if (!meds1 && !meds2) return true;
  if (!meds1 || !meds2 || meds1.length !== meds2.length) return false;

  return meds1.every((med, idx) => {
    const other = meds2[idx];
    return (
      med.name === other.name &&
      med.dosage === other.dosage &&
      med.frequency === other.frequency &&
      med.days === other.days &&
      med.notes === other.notes
    );
  });
}

/**
 * Creates a summary of changes in visit data
 */
export function getVisitChangeSummary(
  original: Visit,
  updated: Partial<Visit>
): string[] {
  const changes: string[] = [];

  if (updated.complaints && updated.complaints !== original.complaints) {
    changes.push("Complaints updated");
  }

  if (updated.diagnosis && updated.diagnosis !== original.diagnosis) {
    changes.push("Diagnosis updated");
  }

  if (!areMedicinesIdentical(updated.prescriptions, original.prescriptions)) {
    changes.push("Medicines updated");
  }

  if (updated.advice && updated.advice !== original.advice) {
    changes.push("Advice updated");
  }

  if (updated.followUpDate && updated.followUpDate !== original.followUpDate) {
    changes.push("Follow-up date updated");
  }

  return changes;
}
