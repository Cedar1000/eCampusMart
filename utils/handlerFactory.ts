/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import APIFeatures from './apiFeatures';
import IQuery from '../interfaces/query.Interface';

import IPayload from '../interfaces/payload.Interface';
import { NotFoundException } from '@nestjs/common';

export const getAll = async (Repo: any, query: Partial<IQuery>) => {
  const payload: Partial<IPayload> = new APIFeatures(query)
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .search()
    .relations().payload;

  const limit = query.limit ? +query.limit : 10;

  const page = query.page ? +query.page : 1;

  const result = await Repo.find(payload);

  const count = await Repo.count(payload);

  const pages = Math.ceil(count / +limit);

  const nextPage = +page < pages ? +page * 1 + 1 : null;

  const prevPage = +page > 1 ? +page - 1 : null;

  return {
    status: 'success',
    message: 'Get All successful!',
    total: result.length,
    nextPage,
    prevPage,
    count,
    pages,
    currentPage: page,
    data: result,
  };
};

export const getOne = async (Repo: any, id: string, query: Partial<IQuery>) => {
  const { relations } = query;

  const payload: any = { where: { id } };

  if (relations) payload.relations = relations.split(',');

  const [result] = await Repo.find(payload);

  if (!result) throw new NotFoundException('No resource with that ID');

  return { status: 'success', message: 'Get One successful!', data: result };
};

export const createOne = async (Repo: any, payload: any) => {
  const data = Repo.create(payload);
  const result = await Repo.save(data);

  return { status: 'success', message: 'create successful!', data: result };
};

export const updateOne = async (Repo: any, id: string, payload: any) => {
  const data = await Repo.findOneBy({ id });

  if (!data) throw new NotFoundException('No resource with that ID');

  const saved = await Repo.save({ ...data, ...payload });

  return { status: 'success', message: 'update successful!', data: saved };
};

export const deleteOne = async (Repo: any, id: string) => {
  const data = await Repo.findOneBy({ id });

  if (!data) throw new NotFoundException('No resource with that ID');
  await Repo.delete({ id });

  return { status: 'success', message: 'delete successful!' };
};
