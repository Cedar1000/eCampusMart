/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as jwt from 'jsonwebtoken';

const token = (id: string) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });

  return { token: accessToken, refreshToken };
};

const verifyRefreshToken = (refreshToken: string): Promise<{ id: string }> => {
  return new Promise((resolve, reject) => {
    jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET,
      (err: any, decoded: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded as { id: string });
        }
      },
    );
  });
};

const refreshAccessToken = async (refreshToken: string) => {
  try {
    const decoded = await verifyRefreshToken(refreshToken);
    const newToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    return { token: newToken, userId: decoded.id };
  } catch (error) {
    console.error('nope', error);
    throw new Error('Invalid refresh token');
  }
};

export { token, verifyRefreshToken, refreshAccessToken };
