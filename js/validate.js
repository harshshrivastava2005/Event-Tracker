/**
 * validate.js - Input Validation Module
 * Handles form validation rules per Functional Requirement FR2:
 * "Validate input: title required, date must be in the future"
 */

const ALLOWED_CATEGORIES = ['Exam', 'Deadline', 'Birthday', 'Meeting', 'Other'];

export const validateEventInput = ({ title, date, category, isEditing = false }) => {
  const errors = {};

  // 1. Title validation
  const trimmedTitle = (title || '').trim();
  if (!trimmedTitle) {
    errors.title = 'Event title is required.';
  } else if (trimmedTitle.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  } else if (trimmedTitle.length > 100) {
    errors.title = 'Title must not exceed 100 characters.';
  }

  // 2. Date validation
  if (!date) {
    errors.date = 'Date and time are required.';
  } else {
    const eventTime = new Date(date).getTime();
    if (isNaN(eventTime)) {
      errors.date = 'Invalid date format.';
    } else if (!isEditing && eventTime <= Date.now()) {
      errors.date = 'Event date and time must be in the future.';
    }
  }

  // 3. Category validation
  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    errors.category = 'Please select a valid category.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Display inline validation errors in form
 */
export const displayValidationErrors = (formEl, errors) => {
  // Clear previous errors
  formEl.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
  formEl.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));

  // Attach new errors
  for (const [field, message] of Object.entries(errors)) {
    const inputEl = formEl.elements[field];
    const errorEl = formEl.querySelector(`#error-${field}`);
    if (inputEl) {
      inputEl.classList.add('has-error');
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }
};

/**
 * Clear form errors
 */
export const clearValidationErrors = (formEl) => {
  formEl.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
  formEl.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
};
