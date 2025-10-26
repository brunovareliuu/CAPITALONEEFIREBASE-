import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../styles/colors';
import { getCategories, updateCategory, deleteCategory } from '../services/firestoreService';

const EditCategoryScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);

  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', icon: 'tag', color: colors.cardColors.blue });
  const [iconPage, setIconPage] = useState(0);
  const iconsPerPage = 24; // 24 por página como solicitado

  useEffect(() => {
    if (!user) return;
    const unsubscribe = getCategories(user.uid, (userCategories) => {
      setCategories(userCategories);
    });
    return () => unsubscribe();
  }, [user]);

  const predefinedColors = useMemo(() => Object.values(colors.cardColors), []);

  const predefinedIcons = useMemo(() => [
    'utensils','car','shopping-bag','film','home','heart','gamepad','book','dumbbell','plane','coffee','gift','music','phone','laptop','camera','bicycle','bus','train','subway','taxi','gas-pump','hospital','pills','user-md','stethoscope','hamburger','pizza-slice','wine-glass','beer','ice-cream','birthday-cake','tshirt','shoe-prints','glasses','clock','ring','gem','tools','wrench','star','user','users','cog','cogs','bell','bookmark','briefcase','building','bullhorn','calendar-alt','certificate','chart-bar','chart-pie','clipboard','cloud','comment','comments','compass','credit-card','desktop','envelope','exclamation-triangle','file-alt','folder','folder-open','globe','graduation-cap','hdd','headphones','heartbeat','history','key','lightbulb','lock','map-marker-alt','mobile-alt','money-bill-alt','paint-brush','paperclip','paste','pen','play-circle','plus-square','print','qrcode','question-circle','receipt','save','search','server','share-alt','shield-alt','shopping-cart','signal','sitemap','sliders-h','smile','sync-alt','tag','tags','tasks','terminal','thumbs-up','thumbs-down','ticket-alt','trash-alt','trophy','truck','tv','unlock','upload','video','wifi','balance-scale','calculator','coins','dollar-sign','euro-sign','file-invoice-dollar','hand-holding-usd','landmark','lira-sign','money-check-alt','percent','pound-sign','ruble-sign','shekel-sign','wallet','won-sign','yen-sign','band-aid','bong','cannabis','capsules','diagnoses','dna','file-medical','first-aid','joint','laptop-medical','notes-medical','prescription-bottle','prescription-bottle-alt','procedures','smoking','syringe','tablets','user-nurse','vial','vials','x-ray','apple-alt','bacon','bone','bread-slice','candy-cane','carrot','cheese','cloud-meatball','cookie','drumstick-bite','egg','fish','hotdog','lemon','pepper-hot','stroopwafel','archway','atlas','bed','church','city','concierge-bell','dungeon','gopuram','hotel','kaaba','map','map-marked-alt','mosque','passport','place-of-worship','road','school','store','store-alt','synagogue','torii-gate','umbrella-beach','university','vihara','anchor','archive','award','baby-carriage','bath','blender','bomb','box','box-open','boxes','broom','bullseye','burn','camera-retro','chair','couch','dice','door-closed','door-open','drafting-compass','drum','feather-alt','fire-extinguisher','flag','futbol','gavel','guitar','hat-wizard','headphones-alt','helicopter','highlighter','id-badge','id-card','id-card-alt','keyboard','leaf','life-ring','lock-open','magic','microphone','microphone-alt','mitten','motorcycle','newspaper','paint-roller','palette','paper-plane','parking','pencil-alt','pencil-ruler','plug','poop','project-diagram','puzzle-piece','recycle','robot','rocket','ruler-combined','ruler-horizontal','ruler-vertical','satellite','satellite-dish','sd-card','search-dollar','search-location','shapes','shower','sim-card','skull-crossbones','solar-panel','space-shuttle','stopwatch','suitcase','suitcase-rolling','tachometer-alt','tablet-alt','tractor','traffic-light','tram','tree','umbrella','utensil-spoon','volleyball-ball','weight-hanging','wheelchair','wind'
  ].filter((icon, index, self) => self.indexOf(icon) === index), []);

  const paginatedIcons = useMemo(() => predefinedIcons.reduce((acc, icon, index) => {
    const pageIndex = Math.floor(index / iconsPerPage);
    if (!acc[pageIndex]) acc[pageIndex] = [];
    acc[pageIndex].push(icon);
    return acc;
  }, []), [predefinedIcons]);

  const startEditing = (category) => {
    setFormData({ name: category.name, icon: category.icon || 'tag', color: category.color || colors.cardColors.blue });
    setEditingCategory(category);
    setIconPage(0);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory) return;
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a name for the category');
      return;
    }
    try {
      await updateCategory(user.uid, editingCategory.id, {
        name: formData.name.trim(),
        icon: formData.icon,
        color: formData.color,
      });
      setEditingCategory(null);
    } catch (error) {
      console.error('Error updating category:', error);
      Alert.alert('Error', 'Could not update category. Please try again.');
    }
  };

  const handleDelete = (category) => {
    Alert.alert('Delete Category', `Are you sure you want to delete "${category.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteCategory(user.uid, category.id);
        } catch (error) {
          console.error('Error deleting category:', error);
          Alert.alert('Error', 'Could not delete category.');
        }
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="times" size={18} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Categories</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {categories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="tags" size={32} color="#ccc" />
              <Text style={styles.emptyText}>No custom categories yet</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.categoryRow}>
                  <View style={[styles.categoryIcon, { backgroundColor: cat.color }]}>
                    <Icon name={cat.icon || 'tag'} size={16} color="#fff" />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryNameText}>{cat.name}</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity style={styles.rowButton} onPress={() => startEditing(cat)}>
                      <Icon name="edit" size={14} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rowButton} onPress={() => handleDelete(cat)}>
                      <Icon name="trash" size={14} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.fab}
          onPress={() => navigation.navigate('CreateCategory')}
        >
          <Icon name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <Modal visible={!!editingCategory} transparent animationType="slide" onRequestClose={() => setEditingCategory(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }] }>
          <View style={[styles.modalContainer, { width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, margin: 0 }] }>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditingCategory(null)}>
                <Text style={styles.headerButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Category</Text>
              <TouchableOpacity onPress={handleSaveEdit}>
                <Icon name="save" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Category name"
              placeholderTextColor="#999"
              value={formData.name}
              onChangeText={(value) => setFormData({ ...formData, name: value })}
              maxLength={20}
            />

            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconsContainer}>
              <View style={styles.iconsGrid}>
                {(paginatedIcons[iconPage] || []).map((iconName) => (
                  <TouchableOpacity
                    key={iconName}
                    style={[styles.iconButton, formData.icon === iconName && styles.selectedIcon]}
                    onPress={() => setFormData({ ...formData, icon: iconName })}
                  >
                    <Icon name={iconName} size={18} color={formData.icon === iconName ? '#007AFF' : '#666'} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.paginationContainer}>
                <TouchableOpacity onPress={() => setIconPage((p) => Math.max(0, p - 1))} disabled={iconPage === 0} style={[styles.paginationButton, iconPage === 0 && styles.paginationButtonDisabled]}>
                  <Icon name="chevron-left" size={16} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.paginationText}>{iconPage + 1} / {paginatedIcons.length}</Text>
                <TouchableOpacity onPress={() => setIconPage((p) => Math.min(paginatedIcons.length - 1, p + 1))} disabled={iconPage === paginatedIcons.length - 1} style={[styles.paginationButton, iconPage === paginatedIcons.length - 1 && styles.paginationButtonDisabled]}>
                  <Icon name="chevron-right" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.label}>Color</Text>
            <View style={styles.colorsGrid}>
              {predefinedColors.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorButton, { backgroundColor: c }, formData.color === c && styles.colorButtonActive]}
                  onPress={() => setFormData({ ...formData, color: c })}
                >
                  {formData.color === c && <Icon name="check" size={14} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  keyboardContainer: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { flex: 1, paddingHorizontal: 20 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#f8f9fa', borderRadius: 12, borderWidth: 2, borderColor: '#e9ecef', borderStyle: 'dashed' },
  emptyText: { fontSize: 16, color: '#666', marginTop: 15 },
  list: { gap: 10 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderWidth: 2, borderColor: '#e9ecef', borderRadius: 12, padding: 12, gap: 12 },
  categoryIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  categoryInfo: { flex: 1 },
  categoryNameText: { fontSize: 16, fontWeight: '600', color: '#333' },
  rowActions: { flexDirection: 'row', gap: 8 },
  rowButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef', borderRadius: 8, padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, margin: 20, width: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 8 },
  input: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef', borderRadius: 12, padding: 12, fontSize: 16, color: '#333' },
  iconsContainer: { alignItems: 'center', marginTop: 8 },
  iconsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8f9fa', borderWidth: 2, borderColor: '#e9ecef', justifyContent: 'center', alignItems: 'center' },
  selectedIcon: { borderColor: '#007AFF', backgroundColor: '#E3F2FD' },
  paginationContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '60%' },
  paginationButton: { padding: 10 },
  paginationButtonDisabled: { opacity: 0.5 },
  paginationText: { fontSize: 16, fontWeight: '600', color: '#333' },
  colorsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  colorButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'transparent' },
  colorButtonActive: { borderColor: '#333' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', borderRadius: 12, padding: 14, marginTop: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default EditCategoryScreen;
