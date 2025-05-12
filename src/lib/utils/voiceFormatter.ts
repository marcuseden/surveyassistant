/**
 * Formats questions to be voice-friendly based on question type
 */

export interface QuestionMetadata {
  response_type?: string;
  options?: string[];
  [key: string]: any;
}

/**
 * Checks if a question is already voice friendly
 */
export function isVoiceFriendly(text: string): boolean {
  const voicePatterns = [
    /please say/i,
    /please tell/i,
    /please respond/i,
    /please answer/i,
    /please select/i,
    /please choose/i
  ];
  
  return voicePatterns.some(pattern => pattern.test(text));
}

/**
 * Formats a question text to be voice-friendly based on its response type
 */
export function formatVoiceQuestion(text: string, metadata?: QuestionMetadata): string {
  // If already voice-friendly, return as is
  if (isVoiceFriendly(text)) {
    return text;
  }
  
  let formattedText = text.trim();
  
  // Make sure the text ends with appropriate punctuation
  if (!formattedText.endsWith('?') && !formattedText.endsWith('.')) {
    formattedText = formattedText + '?';
  }
  
  // Add voice-friendly prompt based on response type
  if (!metadata || !metadata.response_type) {
    return `${formattedText} Please respond with your answer.`;
  }
  
  switch (metadata.response_type) {
    case 'Multiple-Choice':
      if (metadata.options && metadata.options.length > 0) {
        return `${formattedText} Please say one of the following: ${metadata.options.map(opt => `"${opt}"`).join(', ')}.`;
      }
      return `${formattedText} Please select one of the options.`;
      
    case 'Yes-No':
      return `${formattedText} Please say "Yes" or "No".`;
      
    case 'Numeric':
      return `${formattedText} Please say a number.`;
      
    case 'Open-Ended':
      return `${formattedText} Please tell me in your own words.`;
      
    default:
      return `${formattedText} Please respond with your answer.`;
  }
}

/**
 * Validates if a question is well-formed for voice interaction
 * Returns null if valid, or a string with validation issue if not
 */
export function validateVoiceQuestion(text: string, metadata?: QuestionMetadata): string | null {
  if (!text.trim()) {
    return 'Question text cannot be empty';
  }
  
  // Check if question ends with punctuation
  if (!text.endsWith('?') && !text.endsWith('.') && !text.endsWith('!')) {
    return 'Question should end with appropriate punctuation (?, ., !)';
  }
  
  // Check for multiple-choice questions without options
  if (metadata?.response_type === 'Multiple-Choice' && 
      (!metadata.options || metadata.options.length < 2)) {
    return 'Multiple-choice questions should have at least two options';
  }
  
  // Check for very short questions
  if (text.trim().length < 10) {
    return 'Question text is too short for clarity in voice interaction';
  }
  
  return null; // Valid question
}

/**
 * Suggests improvements for a question to make it more voice-friendly
 */
export function suggestVoiceImprovements(text: string, metadata?: QuestionMetadata): string[] {
  const suggestions: string[] = [];
  
  // Check for questions without question marks
  if (!text.endsWith('?') && !text.includes('?')) {
    suggestions.push('Consider phrasing as a question with a question mark');
  }
  
  // Check for very short questions
  if (text.trim().length < 15) {
    suggestions.push('Consider making the question more descriptive for better voice understanding');
  }
  
  // Check for common problematic phrases in voice
  if (text.includes('click') || text.includes('select') || text.includes('check')) {
    suggestions.push('Avoid UI-specific terms like "click", "select", or "check" in voice interactions');
  }
  
  // Suggest improvements for multiple choice
  if (metadata?.response_type === 'Multiple-Choice' && metadata.options) {
    if (metadata.options.some(opt => opt.length > 30)) {
      suggestions.push('Long multiple-choice options can be difficult to remember in voice interactions');
    }
    
    if (metadata.options.length > 5) {
      suggestions.push('Having more than 5 options can be overwhelming in voice interactions');
    }
  }
  
  return suggestions;
} 