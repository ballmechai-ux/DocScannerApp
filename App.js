import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function App() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');

  // เลือกรูปจากกล้องหรือแกลเลอรี
  const pickImage = async (useCamera) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('ต้องอนุญาตการเข้าถึง', 'กรุณาอนุญาตในการตั้งค่า');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.9 });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setImages(prev => [...prev, ...uris]);
    }
  };

  // OCR ผ่าน Google Vision API (ฟรี 1000 ครั้ง/เดือน)
  const runOCR = async () => {
    if (images.length === 0) {
      Alert.alert('กรุณาเพิ่มรูปก่อน');
      return;
    }
    setLoading(true);
    try {
      let allText = '';
      for (let i = 0; i < images.length; i++) {
        const base64 = await FileSystem.readAsStringAsync(images[i], {
          encoding: FileSystem.EncodingType.Base64,
        });
        const body = {
          requests: [{
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION' }]
          }]
        };
        const res = await fetch(
          'https://vision.googleapis.com/v1/images:annotate?key=AIzaSyD-ใส่_API_KEY_ของคุณ',
          { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
        );
        const data = await res.json();
        const text = data.responses?.[0]?.fullTextAnnotation?.text || '(ไม่พบข้อความ)';
        allText += `--- หน้า ${i + 1} ---\n${text}\n\n`;
      }
      setOcrText(allText);
    } catch (e) {
      Alert.alert('เกิดข้อผิดพลาด', e.message);
    }
    setLoading(false);
  };

  // บันทึกและแชร์ผ่าน LINE
  const shareText = async () => {
    if (!ocrText) { Alert.alert('ยังไม่มีข้อความ'); return; }
    const path = FileSystem.documentDirectory + 'document.txt';
    await FileSystem.writeAsStringAsync(path, ocrText);
    await Sharing.shareAsync(path);
  };

  return (
    <ScrollView style={s.bg} contentContainerStyle={s.content}>
      <Text style={s.title}>📄 DocScanner</Text>

      {/* ปุ่มถ่ายรูป */}
      <View style={s.row}>
        <TouchableOpacity style={[s.btn, s.btnGreen]} onPress={() => pickImage(true)}>
          <Text style={s.btnTxt}>📷 ถ่ายรูป</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnBlue]} onPress={() => pickImage(false)}>
          <Text style={s.btnTxt}>🖼️ แกลเลอรี</Text>
        </TouchableOpacity>
      </View>

      {/* แสดงรูป */}
      {images.map((uri, i) => (
        <Image key={i} source={{ uri }} style={s.img} />
      ))}

      {/* ปุ่ม OCR */}
      {images.length > 0 && (
        <TouchableOpacity style={[s.btn, s.btnOrange, { marginTop: 16 }]} onPress={runOCR}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnTxt}>🔍 อ่านข้อความ (OCR)</Text>
          }
        </TouchableOpacity>
      )}

      {/* ผลลัพธ์ */}
      {ocrText !== '' && (
        <View style={s.result}>
          <Text style={s.resultTitle}>ข้อความที่อ่านได้</Text>
          <Text style={s.resultText}>{ocrText}</Text>
          <TouchableOpacity style={[s.btn, s.btnLine]} onPress={shareText}>
            <Text style={s.btnTxt}>💚 ส่งผ่าน LINE</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0a0f1e' },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: '#00d4aa', textAlign: 'center', marginVertical: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnGreen: { backgroundColor: '#00d4aa' },
  btnBlue: { backgroundColor: '#0099ff' },
  btnOrange: { backgroundColor: '#f59e0b' },
  btnLine: { backgroundColor: '#06c755', marginTop: 12 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  img: { width: '100%', height: 200, borderRadius: 12, marginBottom: 8, resizeMode: 'cover' },
  result: { backgroundColor: '#111827', borderRadius: 14, padding: 16, marginTop: 16 },
  resultTitle: { color: '#00d4aa', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  resultText: { color: '#e2e8f0', fontSize: 13, lineHeight: 22 },
});
