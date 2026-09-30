interface IPayload {
  skip: number;
  take: number;
  order: { [key: string]: string };
  where: [{ [key: string]: any }] | any[];
  select: string[];
  relations: string[];
}

export default IPayload;
