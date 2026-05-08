import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, TextInput, Alert, ActivityIndicator,
  StatusBar, Animated, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

const { width } = Dimensions.get('window');

// ─── สี Theme ทอง-ดำ พรีเมียม ───────────────────────────
const C = {
  bg:       '#0a0800',
  surface:  '#130f00',
  surface2: '#1c1600',
  gold:     '#d4a017',
  gold2:    '#f0c040',
  goldDim:  '#7a5c0a',
  text:     '#f5e6c0',
  muted:    '#7a6a40',
  border:   '#2a2000',
  white:    '#fff',
  red:      '#c0392b',
  green:    '#27ae60',
  line:     '#06c755',
};

// ─── Google Vision API Key ────────────────────────────────
// ใส่ API Key ของคุณที่นี่ครับ
const GOOGLE_API_KEY = 'AIzaSyD-ใส่_API_KEY_ของคุณ';

export default function App() {
  const [images, setImages]     = useState([]);
  const [ocrText, setOcrText]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab, setTab]           = useState('scan'); // scan | result
  const [fileName, setFileName] = useState('เอกสาร_' + new Date().toLocaleDateString('th-TH').replace(/\//g,'-'));

  // ─── ถ่ายรูปจากกล้อง ──────────────────────────────────
  const takePhoto = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { Alert.alert('กรุณาอนุญาตการใช้กล้อง'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.95, allowsEditing: true });
    if (!r.canceled) setImages(p => [...p, r.assets[0].uri]);
  };

  // ─── เลือกจากแกลเลอรี ────────────────────────────────
  const pickGallery = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('กรุณาอนุญาตการเข้าถึงแกลเลอรี'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.9 });
    if (!r.canceled) setImages(p => [...p, ...r.assets.map(a => a.uri)]);
  };

  // ─── ลบรูป ───────────────────────────────────────────
  const deleteImage = (i) => {
    Alert.alert('ลบรูป', 'ต้องการลบรูปนี้ใช่ไหม?', [
      { text: 'ยกเลิก' },
      { text: 'ลบ', style: 'destructive', onPress: () => setImages(p => p.filter((_,j) => j !== i)) },
    ]);
  };

  // ─── OCR ด้วย Google Vision ───────────────────────────
  const runOCR = async () => {
    if (!images.length) { Alert.alert('กรุณาเพิ่มรูปภาพก่อน'); return; }
    setLoading(true);
    setProgress(0);
    try {
      let fullText = '';
      for (let i = 0; i < images.length; i++) {
        setProgress(Math.round(((i) / images.length) * 100));
        const base64 = await FileSystem.readAsStringAsync(images[i], {
          encoding: FileSystem.EncodingType.Base64,
        });
        const res = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{
                image: { content: base64 },
                features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
              }],
            }),
          }
        );
        const data = await res.json();
        const text = data.responses?.[0]?.fullTextAnnotation?.text || '(ไม่พบข้อความในหน้านี้)';
        fullText += `═══ หน้าที่ ${i + 1} ═══\n${text}\n\n`;
      }
      setProgress(100);
      setOcrText(fullText);
      setTab('result');
    } catch (e) {
      Alert.alert('เกิดข้อผิดพลาด', e.message);
    }
    setLoading(false);
  };

  // ─── บันทึกรูปลงแกลเลอรี ─────────────────────────────
  const saveImages = async () => {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) { Alert.alert('กรุณาอนุญาตการบันทึก'); return; }
    for (const uri of images) {
      await MediaLibrary.saveToLibraryAsync(uri);
    }
    Alert.alert('✅ บันทึกแล้ว', `บันทึก ${images.length} รูปลงแกลเลอรีแล้วครับ`);
  };

  // ─── Export เป็น Text ─────────────────────────────────
  const exportText = async () => {
    if (!ocrText) { Alert.alert('ยังไม่มีข้อความ OCR'); return; }
    const path = FileSystem.documentDirectory + `${fileName}.txt`;
    await FileSystem.writeAsStringAsync(path, ocrText, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'แชร์ไฟล์ข้อความ' });
  };

  // ─── Export เป็น HTML (เปิดเป็น PDF ได้) ─────────────
  const exportHTML = async () => {
    if (!ocrText && !images.length) { Alert.alert('ยังไม่มีข้อมูล'); return; }
    const imgTags = images.map((_, i) => `<p style="color:#7a6a40">[ รูปหน้า ${i+1} ]</p>`).join('');
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Sarabun', sans-serif; background:#0a0800; color:#f5e6c0; padding:32px; }
  h1 { color:#d4a017; border-bottom:2px solid #d4a017; padding-bottom:8px; }
  .text { background:#130f00; border:1px solid #2a2000; border-radius:12px; padding:20px; margin:16px 0; line-height:1.8; white-space:pre-wrap; }
  .footer { color:#7a6a40; font-size:12px; margin-top:32px; text-align:center; }
</style>
</head>
<body>
  <h1>📄 ${fileName}</h1>
  ${imgTags}
  <div class="text">${ocrText.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
  <div class="footer">สร้างโดย DocScanner Pro | ${new Date().toLocaleDateString('th-TH', {year:'numeric',month:'long',day:'numeric'})}</div>
</body>
</html>`;
    const path = FileSystem.documentDirectory + `${fileName}.html`;
    await FileSystem.writeAsStringAsync(path, html, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'text/html', dialogTitle: 'แชร์เป็น PDF/HTML' });
  };

  // ─── แชร์ LINE ────────────────────────────────────────
  const shareLine = async () => {
    if (!ocrText) { Alert.alert('ยังไม่มีข้อความ'); return; }
    const path = FileSystem.documentDirectory + `${fileName}.txt`;
    await FileSystem.writeAsStringAsync(path, ocrText);
    await Sharing.shareAsync(path, { dialogTitle: 'ส่งผ่าน LINE' });
  };

  // ─── แชร์รูปภาพ ──────────────────────────────────────
  const shareImages = async () => {
    if (!images.length) { Alert.alert('ไม่มีรูปภาพ'); return; }
    await Sharing.shareAsync(images[0], { dialogTitle: 'แชร์รูปภาพ' });
  };

  // ─── ล้างทั้งหมด ──────────────────────────────────────
  const clearAll = () => {
    Alert.alert('ล้างข้อมูล', 'ต้องการล้างรูปและข้อความทั้งหมดใช่ไหม?', [
      { text: 'ยกเลิก' },
      { text: 'ล้าง', style: 'destructive', onPress: () => { setImages([]); setOcrText(''); setTab('scan'); } },
    ]);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.appName}>DocScanner</Text>
          <Text style={s.appSub}>PRO</Text>
        </View>
        <View style={s.headerRight}>
          <Text style={s.imgCount}>{images.length} หน้า</Text>
          {(images.length > 0 || ocrText) && (
            <TouchableOpacity style={s.clearBtn} onPress={clearAll}>
              <Text style={s.clearBtnTxt}>ล้าง</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, tab==='scan' && s.tabActive]} onPress={() => setTab('scan')}>
          <Text style={[s.tabTxt, tab==='scan' && s.tabTxtActive]}>📷 สแกน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab==='result' && s.tabActive]} onPress={() => setTab('result')}>
          <Text style={[s.tabTxt, tab==='result' && s.tabTxtActive]}>📝 ผลลัพธ์</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {tab === 'scan' && <>

          {/* ── Action Buttons ── */}
          <View style={s.actionRow}>
            <TouchableOpacity style={[s.actionBtn, s.btnCamera]} onPress={takePhoto}>
              <Text style={s.actionIcon}>📷</Text>
              <Text style={s.actionLabel}>ถ่ายรูป</Text>
              <Text style={s.actionSub}>กล้อง</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.btnGallery]} onPress={pickGallery}>
              <Text style={s.actionIcon}>🖼️</Text>
              <Text style={s.actionLabel}>แกลเลอรี</Text>
              <Text style={s.actionSub}>หลายรูป</Text>
            </TouchableOpacity>
          </View>

          {/* ── Image Grid ── */}
          {images.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>รูปภาพ {images.length} หน้า</Text>
              <View style={s.grid}>
                {images.map((uri, i) => (
                  <TouchableOpacity key={i} style={s.imgCard} onLongPress={() => deleteImage(i)}>
                    <Image source={{ uri }} style={s.imgThumb} />
                    <View style={s.imgOverlay}>
                      <Text style={s.imgNum}>{i + 1}</Text>
                    </View>
                    <TouchableOpacity style={s.delBtn} onPress={() => deleteImage(i)}>
                      <Text style={s.delTxt}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📂</Text>
              <Text style={s.emptyTitle}>ยังไม่มีรูปภาพ</Text>
              <Text style={s.emptySub}>กดถ่ายรูปหรือเลือกจากแกลเลอรีครับ</Text>
            </View>
          )}

          {/* ── Save Images ── */}
          {images.length > 0 && (
            <TouchableOpacity style={s.btnSave} onPress={saveImages}>
              <Text style={s.btnSaveTxt}>💾 บันทึกรูปลงแกลเลอรี</Text>
            </TouchableOpacity>
          )}

          {/* ── Progress ── */}
          {loading && (
            <View style={s.progressWrap}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={s.progressTxt}>กำลังอ่านข้อความ {progress}%</Text>
              <ActivityIndicator color={C.gold} style={{ marginTop: 8 }} />
            </View>
          )}

          {/* ── OCR Button ── */}
          <TouchableOpacity
            style={[s.btnOCR, (!images.length || loading) && s.btnDisabled]}
            onPress={runOCR}
            disabled={!images.length || loading}
          >
            <Text style={s.btnOCRTxt}>
              {loading ? 'กำลังอ่านข้อความ...' : '🔍 อ่านข้อความ (OCR)'}
            </Text>
          </TouchableOpacity>

        </>}

        {tab === 'result' && <>

          {/* ── File Name ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>ชื่อไฟล์</Text>
            <TextInput
              style={s.fileInput}
              value={fileName}
              onChangeText={setFileName}
              placeholderTextColor={C.muted}
            />
          </View>

          {/* ── Stats ── */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statVal}>{images.length}</Text>
              <Text style={s.statLbl}>หน้า</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statVal}>{ocrText.trim().split(/\s+/).filter(Boolean).length}</Text>
              <Text style={s.statLbl}>คำ</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statVal}>{ocrText.replace(/\s/g,'').length}</Text>
              <Text style={s.statLbl}>ตัวอักษร</Text>
            </View>
          </View>

          {/* ── OCR Text ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>ข้อความ OCR (แก้ไขได้)</Text>
            <TextInput
              style={s.textEditor}
              value={ocrText}
              onChangeText={setOcrText}
              multiline
              placeholder="ผลลัพธ์ OCR จะแสดงที่นี่..."
              placeholderTextColor={C.muted}
              textAlignVertical="top"
            />
          </View>

          {/* ── Export Options ── */}
          <Text style={s.sectionTitle}>ส่งออกไฟล์</Text>

          <View style={s.exportGrid}>
            <TouchableOpacity style={[s.exportBtn, s.exportTxt]} onPress={exportText}>
              <Text style={s.exportIcon}>📄</Text>
              <Text style={s.exportName}>Text</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.exportBtn, s.exportPdf]} onPress={exportHTML}>
              <Text style={s.exportIcon}>📋</Text>
              <Text style={s.exportName}>HTML/PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.exportBtn, s.exportImg]} onPress={shareImages}>
              <Text style={s.exportIcon}>🖼️</Text>
              <Text style={s.exportName}>รูปภาพ</Text>
            </TouchableOpacity>
          </View>

          {/* ── Share Buttons ── */}
          <View style={s.shareRow}>
            <TouchableOpacity style={s.btnShare} onPress={shareLine}>
              <Text style={s.shareIcon}>💚</Text>
              <Text style={s.shareTxt}>LINE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnShare, s.btnShareAll]} onPress={exportText}>
              <Text style={s.shareIcon}>📤</Text>
              <Text style={s.shareTxt}>แชร์อื่นๆ</Text>
            </TouchableOpacity>
          </View>

          {/* ── Back to scan ── */}
          <TouchableOpacity style={s.btnBack} onPress={() => setTab('scan')}>
            <Text style={s.btnBackTxt}>← กลับไปสแกนเพิ่ม</Text>
          </TouchableOpacity>

        </>}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  appName: { fontSize: 24, fontWeight: '900', color: C.gold, letterSpacing: 2 },
  appSub: { fontSize: 10, color: C.goldDim, letterSpacing: 4, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  imgCount: { fontSize: 13, color: C.muted, fontFamily: 'monospace' },
  clearBtn: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  clearBtnTxt: { color: C.red, fontSize: 13, fontWeight: '700' },

  // Tab Bar
  tabBar: { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.gold },
  tabTxt: { fontSize: 14, color: C.muted, fontWeight: '600' },
  tabTxtActive: { color: C.gold },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 20, marginTop: 4 },
  actionBtn: {
    flex: 1, borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1,
  },
  btnCamera: { backgroundColor: C.surface, borderColor: C.gold },
  btnGallery: { backgroundColor: C.surface, borderColor: C.goldDim },
  actionIcon: { fontSize: 32, marginBottom: 8 },
  actionLabel: { fontSize: 15, fontWeight: '800', color: C.text },
  actionSub: { fontSize: 11, color: C.muted, marginTop: 2 },

  // Section
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: C.goldDim,
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10,
  },

  // Image Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imgCard: {
    width: (width - 56) / 3,
    aspectRatio: 3/4,
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.border,
  },
  imgThumb: { width: '100%', height: '100%' },
  imgOverlay: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
  },
  imgNum: { color: C.gold, fontSize: 10, fontFamily: 'monospace', fontWeight: '700' },
  delBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(192,57,43,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  delTxt: { color: C.white, fontSize: 11, fontWeight: '900' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 52, marginBottom: 12, opacity: 0.4 },
  emptyTitle: { fontSize: 16, color: C.muted, fontWeight: '700' },
  emptySub: { fontSize: 13, color: C.goldDim, marginTop: 4 },

  // Progress
  progressWrap: { marginBottom: 16 },
  progressBg: { height: 4, backgroundColor: C.surface2, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: C.gold, borderRadius: 2 },
  progressTxt: { fontSize: 12, color: C.muted, textAlign: 'center', fontFamily: 'monospace' },

  // Buttons
  btnSave: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.goldDim,
    borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12,
  },
  btnSaveTxt: { color: C.gold, fontSize: 14, fontWeight: '700' },

  btnOCR: {
    backgroundColor: C.gold, borderRadius: 14,
    padding: 18, alignItems: 'center', marginTop: 4,
    shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  btnDisabled: { opacity: 0.3 },
  btnOCRTxt: { color: C.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  // File Input
  fileInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, padding: 14, color: C.text, fontSize: 15, fontWeight: '700',
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  statVal: { fontSize: 22, fontWeight: '900', color: C.gold, fontFamily: 'monospace' },
  statLbl: { fontSize: 11, color: C.muted, marginTop: 2 },

  // Text Editor
  textEditor: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 14, color: C.text, fontSize: 14,
    lineHeight: 22, minHeight: 200, maxHeight: 320,
  },

  // Export
  exportGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  exportBtn: {
    flex: 1, borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1,
  },
  exportTxt: { backgroundColor: C.surface, borderColor: C.goldDim },
  exportPdf: { backgroundColor: C.surface, borderColor: C.gold },
  exportImg: { backgroundColor: C.surface, borderColor: C.goldDim },
  exportIcon: { fontSize: 24, marginBottom: 6 },
  exportName: { fontSize: 12, color: C.text, fontWeight: '700' },

  // Share
  shareRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  btnShare: {
    flex: 1, backgroundColor: C.line, borderRadius: 12,
    padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnShareAll: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  shareIcon: { fontSize: 18 },
  shareTxt: { color: C.white, fontSize: 15, fontWeight: '800' },

  btnBack: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4,
  },
  btnBackTxt: { color: C.muted, fontSize: 14, fontWeight: '600' },
});
