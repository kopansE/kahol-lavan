import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

// Validation functions
function validateLicensePlate(plate: string): { valid: boolean; error?: string } {
  if (!plate || plate.trim().length === 0) {
    return { valid: false, error: "License plate is required" };
  }

  // Israeli license plate format: 7-8 digits with optional dashes
  // Examples: "12-345-67", "123-45-678", "1234567"
  const plateRegex = /^\d{2,3}-?\d{2}-?\d{3}$/;
  
  if (!plateRegex.test(plate.trim())) {
    return { 
      valid: false, 
      error: "Invalid license plate format. Expected format: XX-XXX-XX or XXX-XX-XXX" 
    };
  }

  return { valid: true };
}

function validateTextField(
  value: string,
  fieldName: string,
  maxLength: number
): { valid: boolean; error?: string } {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (value.trim().length > maxLength) {
    return { 
      valid: false, 
      error: `${fieldName} must be ${maxLength} characters or less` 
    };
  }

  // Allow letters, numbers, spaces, and basic punctuation
  const textRegex = /^[a-zA-Z0-9\s\-'.]+$/;
  if (!textRegex.test(value.trim())) {
    return { 
      valid: false, 
      error: `${fieldName} contains invalid characters` 
    };
  }

  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const { car_license_plate, car_make, car_model, car_color } = await req.json();

    // Validate license plate
    const plateValidation = validateLicensePlate(car_license_plate);
    if (!plateValidation.valid) {
      return errorResponse(plateValidation.error!, 400);
    }

    // Validate car make
    const makeValidation = validateTextField(car_make, "Car make", 50);
    if (!makeValidation.valid) {
      return errorResponse(makeValidation.error!, 400);
    }

    // Validate car model
    const modelValidation = validateTextField(car_model, "Car model", 50);
    if (!modelValidation.valid) {
      return errorResponse(modelValidation.error!, 400);
    }

    // Validate car color
    const colorValidation = validateTextField(car_color, "Car color", 30);
    if (!colorValidation.valid) {
      return errorResponse(colorValidation.error!, 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Update user's car information
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        car_license_plate: car_license_plate.trim(),
        car_make: car_make.trim(),
        car_model: car_model.trim(),
        car_color: car_color.trim(),
        user_data_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error updating user car data:", updateError);
      return errorResponse(`Failed to update car data: ${updateError.message}`, 500);
    }

    console.log("✅ User car data updated successfully:", user.id);

    return successResponse({
      success: true,
      message: "Car data updated successfully",
      user: {
        car_license_plate: updatedUser.car_license_plate,
        car_make: updatedUser.car_make,
        car_model: updatedUser.car_model,
        car_color: updatedUser.car_color,
        user_data_complete: updatedUser.user_data_complete,
      },
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return errorResponse(error.message || "Internal server error");
  }
});
