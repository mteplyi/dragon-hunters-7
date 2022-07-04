import { promisify } from 'util';

export const delay = promisify(setTimeout);

export const isStaticType = <T> (value: T): value is T => true;
