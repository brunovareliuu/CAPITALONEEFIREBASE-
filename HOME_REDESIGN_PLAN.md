# Plan: Rediseño de HomeScreen - Estilo NU Bank + Capital One

## 🎨 Objetivo
Rediseñar el HomeScreen con el estilo moderno de NU Bank, manteniendo los colores de Capital One (#004977, #0073CF) y todo en inglés.

---

## 📱 Estructura Visual (Top to Bottom)

### 1. **Header Section** (Purple/Blue gradient)
```
┌─────────────────────────────────┐
│  👤  Hello, [Name]         ⚙️ 🔔│
│                                 │
│  [Account promotion card]       │
│  "Grow your credit line..."     │
└─────────────────────────────────┘
```

**Componentes actuales a usar:**
- Ya existe: `greetingHeader` + `userNameText`
- Modificar colores: Capital One Blue gradient
- Agregar: Ícono de perfil, settings, notificaciones

---

### 2. **Checking Account Card** (Reemplaza "Cuenta Nu")
```
┌─────────────────────────────────┐
│  Checking Account          →    │
│  $125.20                        │
│                                 │
│  •••• 1234                      │
└─────────────────────────────────┘
```

**Componentes actuales a usar:**
- Ya existe: `BalanceCard` component
- Cambiar: 
  - Título: "Cuenta Nu" → "Checking Account"
  - Usar: `tarjetaDigital` (CHECKING card)
  - Colores: Capital One gradient (#004977 → #0073CF)

---

### 3. **Quick Actions Grid** (4 iconos redondos)
```
┌────────────────────────────────┐
│  [Deposit]  [Transfer]         │
│  [Simulate]  [Available]       │
│  [Receive]   [History]         │
│  [Bills]     [Plans]           │
└────────────────────────────────┘
```

**Componentes actuales a usar:**
- Ya existe: `quickActionsGrid`
- Agregar más acciones:
  - **Receive & Deposit**: Nueva funcionalidad
  - **Transfer**: Ya existe (`navigation.navigate('Transfer')`)
  - **Simulate loan**: Nueva funcionalidad
  - **Available balance**: Link a detalles de cuenta
  - **Pay bills**: Ya existe (`navigation.navigate('Bills')`)
  - **History**: Ya existe (`navigation.navigate('TransferHistory')`)
  - **Plans**: Ya existe (`navigation.navigate('Plans')`)

**Nuevo Layout:**
- 4 columnas x 2 filas
- Iconos grandes en círculos de colores

---

### 4. **Credit Card Section** (Nuevo - similar a NU)
```
┌─────────────────────────────────┐
│  Credit Card                →   │
│                                 │
│  Current balance                │
│  $0.00                          │
│                                 │
│  Due date: Nov 13               │
│  Available limit: $500.00       │
└─────────────────────────────────┘
```

**Implementación:**
- **Nuevo componente**: `CreditCardSection`
- **Datos**: 
  - Buscar tarjetas digitales con `type === 'Credit Card'`
  - Mostrar balance, límite, fecha de corte
- **Navegación**: 
  - Click → `TarjetaDigitalDetails` (Credit Card)

---

### 5. **MSI (Installments) Section** (Nuevo)
```
┌─────────────────────────────────┐
│  MSI with Capital One      →    │
│                                 │
│  [Icon] Split your purchases    │
│         into interest-free      │
│         installments            │
└─────────────────────────────────┘
```

**Implementación:**
- **Nuevo componente**: `MSISection`
- **Link**: Puede ir a una pantalla informativa o modal
- **Estilo**: Card similar a "Personal Loan" de NU

---

### 6. **My Cards Section** (Nuevo)
```
┌─────────────────────────────────┐
│  My Cards                   →   │
│                                 │
│  [Card Icon] View and manage    │
│             your cards          │
└─────────────────────────────────┘
```

**Implementación:**
- **Nuevo componente**: `MyCardsSection`
- **Navegación**: Lista todas las tarjetas digitales del usuario
- **Link**: Nueva pantalla `MyCardsScreen` o usar `TarjetaDigitalDetails`

---

### 7. **Recent Activity** (Ya existe - mejorar)
```
┌─────────────────────────────────┐
│  Recent Activity        See all │
│                                 │
│  🛒 Starbucks Purchase     -$12 │
│     2 hours ago                 │
│                                 │
│  💼 Payroll Deposit      +$2500 │
│     Yesterday                   │
└─────────────────────────────────┘
```

**Componentes actuales a usar:**
- Ya existe: `activitySection` + `activityList`
- **Mejorar**:
  - Iconos más grandes
  - Mejor formato de fechas
  - Colores más contrastantes

---

### 8. **Discover More Section** (Nuevo - bottom promotional)
```
┌─────────────────────────────────┐
│  Discover More                  │
│                                 │
│  ┌─────────────┐ ┌────────────┐│
│  │ [Image]     │ │ [Image]    ││
│  │             │ │            ││
│  │ The Capital │ │ MSI in the ││
│  │ One era is  │ │ Capital One││
│  │ shared      │ │ style      ││
│  │             │ │            ││
│  │ [Learn more]│ │ [See more] ││
│  └─────────────┘ └────────────┘│
└─────────────────────────────────┘
```

**Implementación:**
- **Nuevo componente**: `DiscoverMoreSection`
- **Contenido**: Promociones, nuevas features, referrals
- **Cards**: Horizontal scroll con imágenes y CTAs
- **Data**: Puede ser hardcoded inicialmente o desde Firestore

---

### 9. **Bottom Feedback Section** (Nuevo)
```
┌─────────────────────────────────┐
│  ❤️  Rate your experience       │
└─────────────────────────────────┘
```

**Implementación:**
- **Nuevo componente**: `FeedbackSection`
- **Link**: Modal o external survey

---

## 🎨 Paleta de Colores

### Capital One Branding
```javascript
const CapitalOneColors = {
  primary: '#004977',      // Dark Blue
  secondary: '#0073CF',    // Bright Blue
  accent: '#00A3E0',       // Light Blue
  success: '#34C759',      // Green (keep)
  warning: '#FF9500',      // Orange (keep)
  error: '#FF3B30',        // Red (keep)
  
  // Gradients
  cardGradient: ['#004977', '#0073CF', '#00A3E0'],
  headerGradient: ['#004977', '#0073CF'],
  
  // Backgrounds
  background: '#F8F9FA',
  cardBackground: '#FFFFFF',
  
  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textLight: '#999999',
};
```

---

## 📋 Componentes a Crear

### 1. **CreditCardSection.js**
```javascript
const CreditCardSection = ({ navigation, creditCard }) => {
  return (
    <TouchableOpacity 
      style={styles.creditCardSection}
      onPress={() => navigation.navigate('TarjetaDigitalDetails', { tarjetaDigital: creditCard })}
    >
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Credit Card</Text>
        <Icon name="chevron-right" size={20} color="#666" />
      </View>
      
      <View style={styles.creditCardContent}>
        <Text style={styles.creditCardLabel}>Current balance</Text>
        <Text style={styles.creditCardAmount}>${creditCard.saldo.toFixed(2)}</Text>
        
        <View style={styles.creditCardDetails}>
          <Text style={styles.creditCardDetailText}>
            Due date: {formatDate(creditCard.fechaCorte)}
          </Text>
          <Text style={styles.creditCardDetailText}>
            Available limit: ${(creditCard.limiteCredito - creditCard.saldo).toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
```

### 2. **MSISection.js**
```javascript
const MSISection = ({ navigation }) => {
  return (
    <TouchableOpacity 
      style={styles.msiSection}
      onPress={() => navigation.navigate('MSIInfo')}
      activeOpacity={0.8}
    >
      <View style={styles.msiContent}>
        <Icon name="credit-card" size={40} color="#0073CF" />
        <View style={styles.msiText}>
          <Text style={styles.msiTitle}>MSI with Capital One</Text>
          <Text style={styles.msiSubtitle}>
            Split your purchases into interest-free installments
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );
};
```

### 3. **MyCardsSection.js**
```javascript
const MyCardsSection = ({ navigation }) => {
  return (
    <TouchableOpacity 
      style={styles.myCardsSection}
      onPress={() => navigation.navigate('MyCards')}
      activeOpacity={0.8}
    >
      <View style={styles.myCardsContent}>
        <View style={styles.myCardsIcon}>
          <Icon name="wallet" size={32} color="#fff" />
        </View>
        <View style={styles.myCardsText}>
          <Text style={styles.myCardsTitle}>My Cards</Text>
          <Text style={styles.myCardsSubtitle}>
            View and manage your cards
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );
};
```

### 4. **DiscoverMoreSection.js**
```javascript
const DiscoverMoreSection = () => {
  const promos = [
    {
      id: '1',
      title: 'The Capital One era is shared',
      subtitle: 'Invite someone to get their account with up to 15% more annual interest.',
      ctaText: 'Learn more',
      backgroundColor: '#E8F5E9',
      icon: 'users'
    },
    {
      id: '2',
      title: 'MSI in the Capital One style',
      subtitle: 'Now your brands. Learn about them!',
      ctaText: 'See more',
      backgroundColor: '#E3F2FD',
      icon: 'credit-card'
    }
  ];

  return (
    <View style={styles.discoverSection}>
      <Text style={styles.discoverTitle}>Discover More</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.promoScroll}
      >
        {promos.map(promo => (
          <TouchableOpacity 
            key={promo.id} 
            style={[styles.promoCard, { backgroundColor: promo.backgroundColor }]}
            activeOpacity={0.8}
          >
            <View style={styles.promoIcon}>
              <Icon name={promo.icon} size={32} color="#0073CF" />
            </View>
            <Text style={styles.promoTitle}>{promo.title}</Text>
            <Text style={styles.promoSubtitle}>{promo.subtitle}</Text>
            <TouchableOpacity style={styles.promoButton}>
              <Text style={styles.promoButtonText}>{promo.ctaText}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};
```

### 5. **FeedbackSection.js**
```javascript
const FeedbackSection = () => {
  return (
    <TouchableOpacity style={styles.feedbackSection} activeOpacity={0.8}>
      <Icon name="heart" size={24} color="#FF3B30" />
      <Text style={styles.feedbackText}>Rate your experience</Text>
    </TouchableOpacity>
  );
};
```

---

## 🔄 Modificaciones a HomeScreen.js

### Cambios en `BalanceCard` (líneas 782-930)

**ANTES:**
```javascript
<Text style={styles.greetingText}>
  Hola, <Text style={styles.userNameText}>...</Text>
</Text>
```

**DESPUÉS:**
```javascript
<View style={styles.topHeader}>
  <View style={styles.headerLeft}>
    <Icon name="user-circle" size={32} color="#fff" />
    <Text style={styles.greetingText}>
      Hello, <Text style={styles.userNameText}>{firstName}</Text>
    </Text>
  </View>
  <View style={styles.headerRight}>
    <TouchableOpacity style={styles.headerIcon}>
      <Icon name="cog" size={20} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.headerIcon}>
      <Icon name="bell" size={20} color="#fff" />
    </TouchableOpacity>
  </View>
</View>
```

### Cambios en Main Card

**ANTES:**
```javascript
<Text style={styles.balanceCardTitle}>{tarjetaDigital?.nickname || 'Digital Card'}</Text>
```

**DESPUÉS:**
```javascript
<Text style={styles.balanceCardTitle}>Checking Account</Text>
```

### Agregar Quick Actions completas

**ANTES:** 4 acciones
**DESPUÉS:** 8 acciones (4x2 grid)

```javascript
<View style={styles.quickActionsGrid}>
  {/* Row 1 */}
  <QuickAction icon="download" label="Deposit & Receive" onPress={...} color="#E8F5E8" iconColor="#388E3C" />
  <QuickAction icon="paper-plane" label="Transfer" onPress={() => navigation.navigate('Transfer')} color="#E3F2FD" iconColor="#1976D2" />
  <QuickAction icon="calculator" label="Simulate Loan" onPress={...} color="#FFF3E0" iconColor="#FF9500" />
  <QuickAction icon="wallet" label="Available" onPress={...} color="#E8F5E8" iconColor="#388E3C" />
  
  {/* Row 2 */}
  <QuickAction icon="receipt" label="Pay Bills" onPress={() => navigation.navigate('Bills')} color="#FFEBEE" iconColor="#F44336" />
  <QuickAction icon="history" label="History" onPress={() => navigation.navigate('TransferHistory')} color="#F3E5F5" iconColor="#9C27B0" />
  <QuickAction icon="bullseye" label="Plans" onPress={() => navigation.navigate('Plans')} color="#E3F2FD" iconColor="#1976D2" />
  <QuickAction icon="chart-line" label="Insights" onPress={...} color="#FFF8E1" iconColor="#FFA726" />
</View>
```

### Insertar nuevas secciones DESPUÉS de Quick Actions

```javascript
{/* Quick Actions */}
<View style={styles.quickActionsSection}>...</View>

{/* NUEVO: Credit Card Section */}
{creditCard && <CreditCardSection navigation={navigation} creditCard={creditCard} />}

{/* NUEVO: MSI Section */}
<MSISection navigation={navigation} />

{/* NUEVO: My Cards Section */}
<MyCardsSection navigation={navigation} />

{/* Recent Activity (ya existe) */}
<View style={styles.activitySection}>...</View>

{/* NUEVO: Discover More */}
<DiscoverMoreSection />

{/* NUEVO: Feedback */}
<FeedbackSection />
```

---

## 🎯 Plan de Implementación

### Fase 1: Actualizar Estructura Básica
1. ✅ Modificar header (Hello + icons)
2. ✅ Cambiar "Cuenta Nu" → "Checking Account"
3. ✅ Actualizar colores a Capital One palette
4. ✅ Traducir todo a inglés

### Fase 2: Expandir Quick Actions
5. ✅ Aumentar grid de 4 a 8 acciones
6. ✅ Agregar iconos y navegación para cada acción
7. ✅ Ajustar estilos (iconos más grandes, mejor spacing)

### Fase 3: Agregar Secciones Nuevas
8. ✅ Crear `CreditCardSection` component
9. ✅ Crear `MSISection` component
10. ✅ Crear `MyCardsSection` component
11. ✅ Crear `DiscoverMoreSection` component
12. ✅ Crear `FeedbackSection` component

### Fase 4: Integrar en HomeScreen
13. ✅ Insertar componentes en orden correcto
14. ✅ Ajustar spacing y padding
15. ✅ Testing en dispositivo

### Fase 5: Polish
16. ✅ Animaciones smooth
17. ✅ Pull-to-refresh
18. ✅ Loading states
19. ✅ Empty states

---

## 📊 Datos Necesarios

### De Firestore (ya existe):
- `tarjetaDigital` (Checking Account)
- `user` profile
- `recentActivities`

### Nuevos queries necesarios:
```javascript
// Obtener Credit Card del usuario
const creditCard = tarjetasDigitales.find(t => t.tipo === 'Credit Card');

// Obtener todas las tarjetas
const allCards = tarjetasDigitales;

// Nombre corto del usuario
const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0];
```

---

## 🎨 Estilos Clave

### Header con gradient
```javascript
topHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 20,
  paddingTop: 60, // SafeArea
  background: 'linear-gradient(135deg, #004977 0%, #0073CF 100%)',
},
```

### Quick Actions Grid (4x2)
```javascript
quickActionsGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: 16,
},
quickActionButton: {
  width: '22%', // 4 columns
  alignItems: 'center',
  marginBottom: 20,
},
```

### Sections con shadow sutil
```javascript
creditCardSection: {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 20,
  marginHorizontal: 20,
  marginBottom: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
},
```

---

## ✅ Checklist Final

- [ ] Header actualizado con Hello + icons
- [ ] Checking Account card (en lugar de Cuenta Nu)
- [ ] Colores Capital One aplicados
- [ ] Todo traducido a inglés
- [ ] 8 Quick Actions implementadas
- [ ] Credit Card Section agregada
- [ ] MSI Section agregada
- [ ] My Cards Section agregada
- [ ] Discover More Section agregada
- [ ] Feedback Section agregada
- [ ] Recent Activity mejorada
- [ ] Smooth scrolling
- [ ] Pull-to-refresh
- [ ] Responsive en todos los tamaños
- [ ] Testing completo

---

## 🚀 Resultado Final

El HomeScreen tendrá:
1. **Header profesional** con Capital One branding
2. **Checking Account card** como hero element
3. **8 Quick Actions** organizadas en grid
4. **Credit Card, MSI, My Cards** sections
5. **Recent Activity** optimizada
6. **Discover More** con promociones
7. **Feedback** section al final

**TODO en inglés, con colores Capital One, estilo NU Bank moderno.** 🎯

