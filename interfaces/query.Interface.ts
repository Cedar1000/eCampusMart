interface IQuery {
  companyId: any;
  userId?: any;
  status?: any;
  sort?: string;
  fields?: string;
  page?: string;
  limit?: string;
  search?: string;
  relations?: string;
  walletId?: string;
}

export default IQuery;
