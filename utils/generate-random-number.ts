export const generateRandomNumber = (noOfDigits: number): number => {
  const array: number[] = [];

  for (let index = 1; index <= noOfDigits; index++) {
    const number = Math.floor(Math.random() * 10);
    array.push(number);
  }

  const result = array.join('');

  return +result;
};
