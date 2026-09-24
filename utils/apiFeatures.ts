/* eslint-disable @typescript-eslint/ban-ts-comment */
import { ILike } from 'typeorm';

import APIFeaturesInterface from '../interfaces/apiFeatures.Interface';
import IQuery from '../interfaces/query.Interface';
import IPayload from '../interfaces/payload.Interface';
import generateApiFilter from './generateApiFilter';

class APIFeatures implements APIFeaturesInterface {
  query: Partial<IQuery>;
  payload: Partial<IPayload> = {
    skip: 10,
    take: 10,
    order: {},
    where: [],
    select: [],
  };

  constructor(query: Partial<IQuery>) {
    this.query = query;
  }

  filter(): this {
    const queryObj = { ...this.query };
    const excludedFields = [
      'page',
      'range',
      'sort',
      'limit',
      'fields',
      'search',
      'relations',
    ];

    excludedFields.forEach((el) => delete queryObj[el]);

    // 1B)Advanced Filtering
    // let queryStr = JSON.stringify(queryObj);
    // queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    // this.payload.where = JSON.parse(queryStr);

    const filter = generateApiFilter(queryObj);

    this.payload.where = filter;
    return this;
  }

  sort(): this {
    if (this.query.sort) {
      const sortBy = this.query.sort.split(',');

      sortBy.forEach((el: string) => {
        const [order, field] = el.split('-');
        if (this.payload.order) {
          this.payload.order[field] = order.toUpperCase();
          this.payload.order.id = order.toUpperCase();
        }
      });
    } else {
      this.payload.order = { createdAt: 'DESC', id: 'DESC' };
    }

    return this;
  }

  limitFields(): this {
    if (this.query.fields) {
      const fields = this.query.fields.split(',');
      this.payload.select = fields;
    }

    return this;
  }

  paginate(): this {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;
    const skip = (page - 1) * limit;

    // page=2&limit=10
    this.payload.skip = skip;
    this.payload.take = limit;

    return this;
  }

  search(): this {
    if (this.query.search) {
      const searches = this.query.search.split('-');
      // @ts-expect-error
      const clone: any[] = [...this.payload.where];

      const result: any[] = [];

      searches.forEach((el) => {
        const [field, term] = el.split(',');

        clone.forEach((el, index) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          result.push({ ...clone[index], [field]: ILike(`%${term}%`) });
        });

        this.payload.where = result;
      });
    }

    return this;
  }

  relations(): this {
    if (this.query.relations) {
      const relations = this.query.relations.split(',');
      this.payload.relations = relations;
    }

    return this;
  }
}

export default APIFeatures;
