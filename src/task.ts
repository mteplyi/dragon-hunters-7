import { delay } from './utils';

export const task = async <T> (value: T) => {
  await delay(100 * Math.random());
  console.log(value);
};
