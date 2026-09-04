interface APIFeatures {
  filter(): this;
  sort(): this;
  paginate(): this;
  relations(): this;
}

export default APIFeatures;
