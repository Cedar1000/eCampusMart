function generateReference() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';

  let result = '';

  // Add the first character from letters
  result += letters.charAt(Math.floor(Math.random() * letters.length));

  // Add the second character from letters
  result += letters.charAt(Math.floor(Math.random() * letters.length));

  // Add the next 7 characters from numbers
  for (let i = 0; i < 7; i++) {
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  // Add the last character from letters
  result += letters.charAt(Math.floor(Math.random() * letters.length));

  return result;
}

export default generateReference;
