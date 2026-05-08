import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

const { width } = Dimensions.get('window');

// ─── Theme ───────────────────────────────────────────────
const C = {
  bg: '#0a0800',
  surface: '#130f00',
  surface2: '#1c1600',
  gold: '#d4a017',
  gold2: '#f0c040',
  goldDim: '#7a5c0a',
  text: '#f5e6c0',
  muted: '#7a6a40',
  border: '#2a2000',
  white: '#fff',
  red: '#c0392b',
  green: '#27ae60',
  line: '#06c755',
};

// ─── ใส่ API KEY จริง ──────────────────────────────────
const GOOGLE_API_KEY = 'ใส่_API_KEY_จริง_ตรงนี้';

export default function App() {
  const [images, setImages] = useState([]);
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState('scan');

  const [fileName, setFileName] = useState(
    'เอกสาร_' +
      new Date().toLocaleDateString('th-TH').replace(/\//g, '-')
  );

  // ─── ถ่ายรูป ─────────────────────────────────────────
  const takePhoto = async () => {
    try {
      const { granted } =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!granted) {
        Alert.alert('ต้องอนุญาตการใช้กล้อง');
        return;
      }

      const r = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        allowsEditing: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!r.canceled) {
        setImages((p) => [...p, r.assets[0].uri]);
      }
    } catch (e) {
      Alert.alert('เกิดข้อผิดพลาด', e.message);
    }
  };

  // ─── เลือกรูป ────────────────────────────────────────
  const pickGallery = async () => {
    try {
      const { granted } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!granted) {
        Alert.alert('ต้องอนุญาตแกลเลอรี');
        return;
      }

      const r = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.5,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!r.canceled) {
        setImages((p) => [
          ...p,
          ...r.assets.map((a) => a.uri),
        ]);
      }
    } catch (e) {
      Alert.alert('เกิดข้อผิดพลาด', e.message);
    }
  };

  // ─── ลบรูป ───────────────────────────────────────────
  const deleteImage = (i) => {
    Alert.alert(
      'ลบรูป',
      'ต้องการลบรูปนี้ใช่ไหม?',
      [
        { text: 'ยกเลิก' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: () => {
            setImages((p) =>
              p.filter((_, j) => j !== i)
            );
          },
        },
      ]
    );
  };

  // ─── OCR ─────────────────────────────────────────────
  const runOCR = async () => {
    if (!images.length) {
      Alert.alert('กรุณาเพิ่มรูปภาพก่อน');
      return;
    }

    if (
      GOOGLE_API_KEY.includes('ใส่_API_KEY')
    ) {
      Alert.alert(
        'ยังไม่ได้ใส่ API KEY',
        'กรุณาใส่ Google Vision API Key ก่อน'
      );
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      let fullText = '';

      for (let i = 0; i < images.length; i++) {
        setProgress(
          Math.round((i / images.length) * 100)
        );

        const base64 =
          await FileSystem.readAsStringAsync(
            images[i],
            {
              encoding:
                FileSystem.EncodingType.Base64,
            }
          );

        const res = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              requests: [
                {
                  image: {
                    content: base64,
                  },
                  features: [
                    {
                      type: 'TEXT_DETECTION',
                      maxResults: 1,
                    },
                  ],
                },
              ],
            }),
          }
        );

        const data = await res.json();

        // ─── Error Google API ─────────────────────
        if (data.error) {
          throw new Error(data.error.message);
        }

        const text =
          data.responses?.[0]
            ?.fullTextAnnotation?.text ||
          '(ไม่พบข้อความ)';

        fullText += `═══ หน้า ${
          i + 1
        } ═══\n${text}\n\n`;
      }

      setProgress(100);
      setOcrText(fullText);
      setTab('result');
    } catch (e) {
      Alert.alert(
        'OCR Error',
        e.message || 'เกิดข้อผิดพลาด'
      );
    }

    setLoading(false);
  };

  // ─── Save Images ─────────────────────────────────────
  const saveImages = async () => {
    try {
      const { granted } =
        await MediaLibrary.requestPermissionsAsync();

      if (!granted) {
        Alert.alert('ต้องอนุญาตการบันทึก');
        return;
      }

      for (const uri of images) {
        await MediaLibrary.saveToLibraryAsync(
          uri
        );
      }

      Alert.alert(
        'สำเร็จ',
        `บันทึก ${images.length} รูปแล้ว`
      );
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    }
  };

  // ─── Export TXT ──────────────────────────────────────
  const exportText = async () => {
    try {
      if (!ocrText) {
        Alert.alert('ยังไม่มีข้อความ');
        return;
      }

      const path =
        FileSystem.documentDirectory +
        `${fileName}.txt`;

      await FileSystem.writeAsStringAsync(
        path,
        ocrText,
        {
          encoding:
            FileSystem.EncodingType.UTF8,
        }
      );

      await Sharing.shareAsync(path, {
        mimeType: 'text/plain',
        dialogTitle: 'แชร์ไฟล์',
      });
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    }
  };

  // ─── Export HTML ─────────────────────────────────────
  const exportHTML = async () => {
    try {
      if (!ocrText && !images.length) {
        Alert.alert('ยังไม่มีข้อมูล');
        return;
      }

      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body{
background:#0a0800;
color:#f5e6c0;
font-family:sans-serif;
padding:24px;
line-height:1.8;
}
h1{
color:#d4a017;
}
.box{
background:#130f00;
padding:20px;
border-radius:12px;
border:1px solid #2a2000;
white-space:pre-wrap;
}
</style>
</head>
<body>

<h1>${fileName}</h1>

<div class="box">
${ocrText
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')}
</div>

</body>
</html>
`;

      const path =
        FileSystem.documentDirectory +
        `${fileName}.html`;

      await FileSystem.writeAsStringAsync(
        path,
        html,
        {
          encoding:
            FileSystem.EncodingType.UTF8,
        }
      );

      await Sharing.shareAsync(path, {
        mimeType: 'text/html',
        dialogTitle: 'แชร์ HTML',
      });
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    }
  };

  // ─── แชร์รูป ─────────────────────────────────────────
  const shareImage = async () => {
    try {
      if (!images.length) {
        Alert.alert('ไม่มีรูป');
        return;
      }

      await Sharing.shareAsync(images[0]);
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    }
  };

  // ─── Clear ───────────────────────────────────────────
  const clearAll = () => {
    Alert.alert(
      'ล้างทั้งหมด',
      'ต้องการล้างข้อมูลใช่ไหม?',
      [
        { text: 'ยกเลิก' },
        {
          text: 'ล้าง',
          style: 'destructive',
          onPress: () => {
            setImages([]);
            setOcrText('');
            setTab('scan');
          },
        },
      ]
    );
  };

  return (
    <View style={s.root}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={C.bg}
      />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.appName}>
            DocScanner
          </Text>
          <Text style={s.appSub}>PRO</Text>
        </View>

        <View style={s.headerRight}>
          <Text style={s.imgCount}>
            {images.length} หน้า
          </Text>

          {(images.length > 0 ||
            ocrText.length > 0) && (
            <TouchableOpacity
              style={s.clearBtn}
              onPress={clearAll}
            >
              <Text style={s.clearBtnTxt}>
                ล้าง
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[
            s.tab,
            tab === 'scan' &&
              s.tabActive,
          ]}
          onPress={() => setTab('scan')}
        >
          <Text
            style={[
              s.tabTxt,
              tab === 'scan' &&
                s.tabTxtActive,
            ]}
          >
            📷 สแกน
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            s.tab,
            tab === 'result' &&
              s.tabActive,
          ]}
          onPress={() =>
            setTab('result')
          }
        >
          <Text
            style={[
              s.tabTxt,
              tab === 'result' &&
                s.tabTxtActive,
            ]}
          >
            📝 ผลลัพธ์
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={
          s.content
        }
      >
        {tab === 'scan' && (
          <>
            {/* Buttons */}
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[
                  s.actionBtn,
                  s.btnCamera,
                ]}
                onPress={takePhoto}
              >
                <Text style={s.actionIcon}>
                  📷
                </Text>
                <Text
                  style={s.actionLabel}
                >
                  ถ่ายรูป
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.actionBtn,
                  s.btnGallery,
                ]}
                onPress={pickGallery}
              >
                <Text style={s.actionIcon}>
                  🖼️
                </Text>
                <Text
                  style={s.actionLabel}
                >
                  แกลเลอรี
                </Text>
              </TouchableOpacity>
            </View>

            {/* Images */}
            {images.length > 0 ? (
              <View style={s.grid}>
                {images.map((uri, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.imgCard}
                    onLongPress={() =>
                      deleteImage(i)
                    }
                  >
                    <Image
                      source={{ uri }}
                      style={s.imgThumb}
                    />

                    <View
                      style={
                        s.imgOverlay
                      }
                    >
                      <Text
                        style={
                          s.imgNum
                        }
                      >
                        {i + 1}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>
                  📂
                </Text>
                <Text style={s.emptyTxt}>
                  ยังไม่มีรูปภาพ
                </Text>
              </View>
            )}

            {/* Save */}
            {images.length > 0 && (
              <TouchableOpacity
                style={s.btnSave}
                onPress={saveImages}
              >
                <Text
                  style={s.btnSaveTxt}
                >
                  💾 บันทึกรูป
                </Text>
              </TouchableOpacity>
            )}

            {/* Progress */}
            {loading && (
              <View
                style={
                  s.progressWrap
                }
              >
                <View
                  style={
                    s.progressBg
                  }
                >
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${progress}%`,
                      },
                    ]}
                  />
                </View>

                <Text
                  style={
                    s.progressTxt
                  }
                >
                  {progress}%
                </Text>

                <ActivityIndicator
                  color={C.gold}
                />
              </View>
            )}

            {/* OCR */}
            <TouchableOpacity
              style={[
                s.btnOCR,
                (!images.length ||
                  loading) &&
                  s.btnDisabled,
              ]}
              onPress={runOCR}
              disabled={
                !images.length ||
                loading
              }
            >
              <Text style={s.btnOCRTxt}>
                {loading
                  ? 'กำลัง OCR...'
                  : '🔍 อ่านข้อความ'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'result' && (
          <>
            <TextInput
              style={s.fileInput}
              value={fileName}
              onChangeText={setFileName}
              placeholder="ชื่อไฟล์"
              placeholderTextColor={
                C.muted
              }
            />

            <TextInput
              style={s.textEditor}
              value={ocrText}
              onChangeText={setOcrText}
              multiline
              textAlignVertical="top"
              placeholder="ผล OCR"
              placeholderTextColor={
                C.muted
              }
            />

            <View style={s.exportGrid}>
              <TouchableOpacity
                style={s.exportBtn}
                onPress={exportText}
              >
                <Text style={s.exportTxt}>
                  📄 TXT
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.exportBtn}
                onPress={exportHTML}
              >
                <Text style={s.exportTxt}>
                  📋 HTML
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.exportBtn}
                onPress={shareImage}
              >
                <Text style={s.exportTxt}>
                  🖼️ รูป
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const mono =
  Platform.OS === 'android'
    ? 'monospace'
    : 'Courier';

// ─── Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,

    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  appName: {
    color: C.gold,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },

  appSub: {
    color: C.goldDim,
    fontSize: 10,
    letterSpacing: 4,
    fontWeight: '700',
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  imgCount: {
    color: C.muted,
    fontSize: 13,
    fontFamily: mono,
  },

  clearBtn: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },

  clearBtnTxt: {
    color: C.red,
    fontWeight: '700',
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },

  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: C.gold,
  },

  tabTxt: {
    color: C.muted,
    fontWeight: '700',
  },

  tabTxtActive: {
    color: C.gold,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },

  actionBtn: {
    flex: 1,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
  },

  btnCamera: {
    backgroundColor: C.surface,
    borderColor: C.gold,
  },

  btnGallery: {
    backgroundColor: C.surface,
    borderColor: C.goldDim,
  },

  actionIcon: {
    fontSize: 34,
    marginBottom: 8,
  },

  actionLabel: {
    color: C.text,
    fontWeight: '800',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },

  imgCard: {
    width: (width - 56) / 3,
    aspectRatio: 3 / 4,
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },

  imgThumb: {
    width: '100%',
    height: '100%',
  },

  imgOverlay: {
    position: 'absolute',
    bottom: 5,
    left: 5,

    backgroundColor:
      'rgba(0,0,0,0.7)',

    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  imgNum: {
    color: C.gold,
    fontFamily: mono,
    fontWeight: '700',
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },

  emptyIcon: {
    fontSize: 50,
    opacity: 0.4,
  },

  emptyTxt: {
    color: C.muted,
    marginTop: 10,
  },

  btnSave: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.goldDim,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },

  btnSaveTxt: {
    color: C.gold,
    fontWeight: '700',
  },

  progressWrap: {
    marginBottom: 16,
  },

  progressBg: {
    height: 4,
    backgroundColor: C.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: C.gold,
  },

  progressTxt: {
    color: C.muted,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: mono,
  },

  btnOCR: {
    backgroundColor: C.gold,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },

  btnDisabled: {
    opacity: 0.3,
  },

  btnOCRTxt: {
    color: C.bg,
    fontWeight: '900',
    fontSize: 16,
  },

  fileInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
    color: C.text,
    marginBottom: 16,
  },

  textEditor: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    color: C.text,
    minHeight: 250,
    lineHeight: 22,
    marginBottom: 20,
  },

  exportGrid: {
    flexDirection: 'row',
    gap: 10,
  },

  exportBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },

  exportTxt: {
    color: C.text,
    fontWeight: '700',
  },
});
