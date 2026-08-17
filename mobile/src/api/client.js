import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:4000/api';
export const UPLOADS_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export const TOKEN_KEY = 'lh_poultry_token';

const client = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function apiErrorMessage(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong';
}

export default client;
