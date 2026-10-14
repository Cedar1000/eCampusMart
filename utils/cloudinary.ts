import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY_FOLDER = 'ECampusMart';

let configured = false;

const getCloudinary = () => {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    configured = true;
  }

  return cloudinary;
};

// Deletes uploads by public id; failures are logged so they never block the request
export const deleteCloudinaryImages = async (publicIds: string[]) => {
  const ids = [...new Set(publicIds.filter(Boolean))];

  // The Admin API accepts at most 100 public ids per call
  for (let i = 0; i < ids.length; i += 100) {
    try {
      await getCloudinary().api.delete_resources(ids.slice(i, i + 100));
    } catch (error) {
      console.error('Cloudinary delete failed', error);
    }
  }
};

export const signCloudinaryUpload = () => {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder: CLOUDINARY_FOLDER };

  return {
    ...paramsToSign,
    signature: getCloudinary().utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET as string,
    ),
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
};
