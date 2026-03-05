// This script is intended to be injected into the page.
// Currently, the popup uses chrome.scripting.executeScript with a function for direct access.
// Future enhancements (e.g., listening for storage events) can be implemented here.

console.log('WebStorage Pro content script loaded.');

// Example: Listen for storage events and send to popup (if popup is open)
window.addEventListener('storage', (event) => {
  // Logic to notify popup could go here
  console.log('Storage changed:', event);
});