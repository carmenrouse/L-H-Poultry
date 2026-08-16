import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import client, { apiErrorMessage } from '../api/client';
import { Button, ErrorText, Screen } from '../components/ui';
import { colors, spacing } from '../theme';

function guessMimeType(uri, fallback) {
  const ext = (uri.split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'pdf') return 'application/pdf';
  return fallback || 'image/jpeg';
}

export default function ScanPOScreen({ navigation }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function uploadFile(uri, mimeType, name) {
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri, name, type: mimeType });
      const { data } = await client.post('/scan/purchase-order', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigation.replace('ScanReview', { draft: data });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function takePhoto() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    setShowCamera(false);
    await uploadFile(photo.uri, 'image/jpeg', 'scan.jpg');
  }

  async function importImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await uploadFile(asset.uri, guessMimeType(asset.uri, 'image/jpeg'), asset.fileName || 'scan.jpg');
  }

  async function importDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
    if (result.canceled) return;
    const asset = result.assets[0];
    await uploadFile(asset.uri, asset.mimeType || guessMimeType(asset.uri), asset.name);
  }

  if (uploading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.uploadingText}>Reading document with OCR...</Text>
      </Screen>
    );
  }

  if (showCamera) {
    if (!permission?.granted) {
      return (
        <Screen style={styles.center}>
          <Text style={styles.permissionText}>Camera access is needed to scan documents.</Text>
          <Button title="Grant camera access" onPress={requestPermission} />
        </Screen>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} />
        <View style={styles.captureBar}>
          <Button title="Cancel" variant="secondary" onPress={() => setShowCamera(false)} style={{ flex: 1, marginRight: spacing.sm }} />
          <Button title="Capture" onPress={takePhoto} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  return (
    <Screen style={{ padding: spacing.md }}>
      <Text style={styles.title}>Scan a paper PO or invoice</Text>
      <Text style={styles.subtitle}>
        We'll run OCR to extract the supplier, line items, quantities, and costs, then let you review and correct
        everything before it's saved as a purchase order.
      </Text>
      <ErrorText text={error} />
      <Button title="Take a photo" onPress={() => setShowCamera(true)} style={{ marginBottom: spacing.md }} />
      <Button title="Choose an image from library" variant="secondary" onPress={importImage} style={{ marginBottom: spacing.md }} />
      <Button title="Import a PDF" variant="secondary" onPress={importDocument} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 20, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg },
  uploadingText: { marginTop: spacing.md, color: colors.textMuted },
  permissionText: { textAlign: 'center', marginBottom: spacing.md, color: colors.text },
  captureBar: { flexDirection: 'row', padding: spacing.md, backgroundColor: colors.background },
});
