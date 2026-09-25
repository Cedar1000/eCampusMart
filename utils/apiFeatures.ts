/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  Between,
  FindOperator,
  ILike,
  In,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
} from 'typeorm';

import APIFeaturesInterface from '../interfaces/apiFeatures.Interface';
import IQuery from '../interfaces/query.Interface';
import IPayload from '../interfaces/payload.Interface';
// import generateApiFilter from './generateApiFilter';

// find({
//   where: {
//     isActive: true,
//     role: In([UserRole.ADMIN, UserRole.USER]),
//     age: MoreThan(20)
//     age: LessThan(20)
//     age: LessThanOrEqual(20)
//     age: MoreThanOrEqual(20)

//     age: Between(20, 30),          // inclusive on both ends
//     firstName: ILike('%john%'),    // case-insensitive LIKE, matches 'regex: john, i'
//   },
// });

// /api/users?age[gte]=20&age[lte]=30&search[firstName||lastName]=john

interface IFilterObject {
  [key: string]: FindOperator<any> | undefined;
}

class APIFeatures implements APIFeaturesInterface {
  query: Partial<IQuery>;

  payload: Partial<IPayload> = {
    skip: 10,
    take: 10,
    order: {},
    where: {},
    select: [],
  };

  constructor(query: Partial<IQuery>) {
    this.query = query;
  }

  filter(): this {
    const queryObj = { ...this.query };

    const excludedFields = [
      'page',
      'sort',
      'limit',
      'fields',
      'search',
      'relations',
    ];

    excludedFields.forEach((el) => delete queryObj[el]);

    // 1B)Advanced Filtering

    const filter = Object.entries(queryObj).reduce(
      (acc: IFilterObject, [key, value]) => {
        const params = {
          gte: (value: string) => MoreThanOrEqual(+value),
          gt: (value: string) => MoreThan(+value),
          lte: (value: string) => LessThanOrEqual(+value),
          lt: (value: string) => LessThan(+value),

          range: (value: string) => {
            const [min, max] = value.split(',');
            return Between(+min, +max);
          },
        };

        if (
          key.includes('gte') ||
          key.includes('gt') ||
          key.includes('lte') ||
          key.includes('lt')
        ) {
          const match = key.match(/\[(.*?)\]/);
          const operator = match ? match[1] : null;

          if (!operator) return acc;

          const [field] = key.split(`[${operator}]`);
          acc[field] = params[operator as keyof typeof params](String(value));
        } else if (key.includes('range')) {
          const match = key.match(/\[(.*?)\]/);
          const operator = match ? match[1] : null;

          if (!operator) return acc;

          const [field] = key.split(`[${operator}]`);
          acc[field] = params[operator as keyof typeof params](String(value));
        } else {
          // Handle regular fields with In() operator
          acc[key] = In((value as string).split(','));
        }

        return acc;
      },
      {} as IFilterObject,
    );

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
