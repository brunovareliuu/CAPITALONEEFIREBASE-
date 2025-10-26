import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  PixelRatio,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../styles/colors';
import { getCardType, getCardColors, getCardTypeLabel, shouldShowTypeBadge } from '../../utils/cardUtils';
import { getAccountBalance, getAccountPurchases, getAccountDeposits, getAccountTransfers, getAllAccountTransactions } from '../../services/nessieService';
import { LineChart, BarChart } from 'react-native-chart-kit';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Función para escalar tamaños basado en el ancho de pantalla
const scale = (size) => {
  const guidelineBaseWidth = 375;
  return (screenWidth / guidelineBaseWidth) * size;
};

// Función para tamaños de fuente responsivos
const scaleFont = (size) => {
  const scaleFactor = PixelRatio.getFontScale();
  return scale(size) / scaleFactor;
};

// Función para espaciado responsivo
const scaleSpacing = (size) => {
  return scale(size);
};

// Determinar si es pantalla pequeña
const isSmallScreen = screenHeight < 600;

// Componente de gráfico mensual de balances
const MonthlyBalanceChart = ({ movements }) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Filtrar movimientos del mes actual
  const currentMonthMovements = movements.filter(movement => {
    const movementDate = new Date(movement.date);
    return movementDate.getMonth() === currentMonth && movementDate.getFullYear() === currentYear;
  });

  // Calcular totales
  const totalInflows = currentMonthMovements
    .filter(m => m.type === 'transfer_in' || m.type === 'ingreso')
    .reduce((sum, m) => sum + Math.abs(m.amount), 0);

  const totalOutflows = currentMonthMovements
    .filter(m => m.type === 'transfer_out' || m.type === 'gasto')
    .reduce((sum, m) => sum + Math.abs(m.amount), 0);

  const netFlow = totalInflows - totalOutflows;

  // Datos para la gráfica de barras
  const chartData = {
    labels: ['Money In', 'Money Out'],
    datasets: [{
      data: [totalInflows, totalOutflows],
      colors: [
        (opacity = 1) => `rgba(52, 199, 89, ${opacity})`, // Verde para ingresos
        (opacity = 1) => `rgba(255, 59, 48, ${opacity})`  // Rojo para retiros
      ]
    }]
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
    style: {
      borderRadius: 12,
    },
    propsForLabels: {
      fontSize: 11,
      fontWeight: '600'
    }
  };

  return (
    <View style={styles.monthlyChartSection}>
      <View style={styles.monthlyChartHeader}>
        <Icon name="chart-bar" size={20} color="#007AFF" />
        <Text style={styles.monthlyChartTitle}>This Month's Activity</Text>
      </View>

      <View style={styles.monthlyChartContent}>
        {/* Resumen de flujos */}
        <View style={styles.flowSummary}>
          <View style={styles.flowItem}>
            <View style={styles.flowIconContainer}>
              <Icon name="arrow-up" size={16} color="#34C759" />
            </View>
            <View style={styles.flowTextContainer}>
              <Text style={styles.flowLabel}>Money In</Text>
              <Text style={[styles.flowAmount, { color: '#34C759' }]}>${totalInflows.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.flowDivider} />

          <View style={styles.flowItem}>
            <View style={styles.flowIconContainer}>
              <Icon name="arrow-down" size={16} color="#FF3B30" />
            </View>
            <View style={styles.flowTextContainer}>
              <Text style={styles.flowLabel}>Money Out</Text>
              <Text style={[styles.flowAmount, { color: '#FF3B30' }]}>${totalOutflows.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Gráfica de barras */}
        <View style={styles.barChartContainer}>
          <BarChart
            data={chartData}
            width={screenWidth - 80}
            height={120}
            chartConfig={chartConfig}
            showBarTops={false}
            fromZero={true}
            style={styles.barChart}
          />
        </View>

        {/* Net Flow */}
        <View style={styles.netFlowContainer}>
          <Text style={styles.netFlowLabel}>Net Flow</Text>
          <Text style={[styles.netFlowAmount, { color: netFlow >= 0 ? '#34C759' : '#FF3B30' }]}>
            {netFlow >= 0 ? '+' : ''}${netFlow.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Componente de proyección de crecimiento de savings
const SavingsProjectionSection = ({ balance }) => {
  // Calcular proyección de crecimiento al 4% anual compuesto
  const calculateProjection = (initialBalance, years = 5) => {
    const annualRate = 0.04; // 4% anual
    const monthlyRate = annualRate / 12;
    const months = years * 12;

    const projection = [];
    let currentBalance = initialBalance;

    // Punto inicial
    projection.push({
      month: 0,
      balance: initialBalance,
      label: 'Now'
    });

    // Calcular crecimiento mensual
    for (let month = 1; month <= months; month++) {
      currentBalance = currentBalance * (1 + monthlyRate);
      projection.push({
        month,
        balance: currentBalance,
        label: month === 12 ? '1 Year' :
               month === 24 ? '2 Years' :
               month === 36 ? '3 Years' :
               month === 48 ? '4 Years' :
               month === 60 ? '5 Years' : ''
      });
    }

    return projection;
  };

  const projection = calculateProjection(balance);
  const finalBalance = projection[projection.length - 1].balance;
  const totalGrowth = finalBalance - balance;

  // Crear labels más espaciados y minimalistas
  const chartLabels = ['Now', '2Y', '4Y', '5Y'];
  const chartDataPoints = [
    projection[0].balance, // Now
    projection[24].balance, // 2 years
    projection[48].balance, // 4 years
    projection[60].balance  // 5 years
  ];

  // Datos para la gráfica - más minimalista
  const chartData = {
    labels: chartLabels,
    datasets: [{
      data: chartDataPoints,
      color: (opacity = 1) => `rgba(52, 199, 89, ${opacity})`,
      strokeWidth: 2
    }]
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(52, 199, 89, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
    style: {
      borderRadius: 12,
    },
    propsForDots: {
      r: '3',
      strokeWidth: '1.5',
      stroke: '#34C759',
      fill: '#ffffff'
    },
    propsForLabels: {
      fontSize: 12,
      fontWeight: '500'
    }
  };

  return (
    <View style={styles.projectionSection}>
      <View style={styles.projectionHeader}>
        <Icon name="chart-line" size={20} color="#34C759" />
        <Text style={styles.projectionTitle}>Growth Projection</Text>
      </View>

      <Text style={styles.projectionSubtitle}>
        See how your savings could grow at 4% annual interest
      </Text>

      {/* Resumen de crecimiento */}
      <View style={styles.growthSummary}>
        <View style={styles.growthRow}>
          <View style={styles.growthItem}>
            <Text style={styles.growthLabel}>Current</Text>
            <Text style={styles.growthAmount}>${balance.toFixed(2)}</Text>
          </View>
          <View style={styles.growthItem}>
            <Text style={styles.growthLabel}>5 Years</Text>
            <Text style={[styles.growthAmount, { color: '#34C759' }]}>${finalBalance.toFixed(2)}</Text>
          </View>
          <View style={styles.growthItem}>
            <Text style={styles.growthLabel}>Growth</Text>
            <Text style={[styles.growthAmount, { color: '#34C759' }]}>+${totalGrowth.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Gráfica de proyección */}
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={screenWidth - 80}
          height={140}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withDots={true}
          withInnerLines={false}
          withOuterLines={false}
          withHorizontalLabels={false}
          withVerticalLabels={true}
        />
      </View>

      <Text style={styles.projectionNote}>
        *Projection assumes 4% annual interest compounded monthly. Actual rates may vary.
      </Text>
    </View>
  );
};

const TarjetaDigitalDetails = ({ navigation, route }) => {
  const { user, dataRefreshTrigger } = useAuth();
  const { tarjetaDigital } = route.params;
  const [showCvv, setShowCvv] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(true); // Mostrar completo por defecto
  const [showBalance, setShowBalance] = useState(true);
  // Solo mostrar transferencias para savings accounts
  const [movements, setMovements] = useState([]);
  const [accountBalance, setAccountBalance] = useState(0);
  const [optimisticTransactions, setOptimisticTransactions] = useState([]); // Transacciones optimistas pendientes

  const cardType = getCardType(tarjetaDigital);
  const cardColors = getCardColors(tarjetaDigital);
  const cardTypeLabel = getCardTypeLabel(tarjetaDigital);
  const showTypeBadge = shouldShowTypeBadge(tarjetaDigital);

  // Funciones para manejar transacciones optimistas
  const addOptimisticTransaction = (transaction) => {
    console.log('🎯 Adding optimistic transaction:', transaction);
    setOptimisticTransactions(prev => [...prev, {
      ...transaction,
      id: `optimistic_${Date.now()}_${Math.random()}`,
      isOptimistic: true,
      status: 'processing'
    }]);
  };

  const removeOptimisticTransaction = (nessieId) => {
    console.log('🗑️ Removing optimistic transaction:', nessieId);
    setOptimisticTransactions(prev => prev.filter(t => t.nessieId !== nessieId));
  };

  const clearOptimisticTransactions = () => {
    console.log('🧹 Clearing all optimistic transactions');
    setOptimisticTransactions([]);
  };

  // Load account balance from Nessie API
  useEffect(() => {
    const loadBalance = async () => {
      if (tarjetaDigital?.nessieAccountId) {
        try {
          const balance = await getAccountBalance(tarjetaDigital.nessieAccountId);
          setAccountBalance(balance);
        } catch (error) {
          console.error('Error loading balance from Nessie API:', error);
          // Fallback to stored balance
          setAccountBalance(tarjetaDigital.saldo || 0);
        }
      } else {
        // Fallback to stored balance if no nessieAccountId
        setAccountBalance(tarjetaDigital?.saldo || 0);
      }
    };

    if (tarjetaDigital) {
      loadBalance();
    }
  }, [tarjetaDigital]);

  // Load real transactions from Nessie API
  // Initialize movements data - CARGAR DESDE EL API
  useEffect(() => {
    const loadTransactions = async () => {
      // For credit cards, don't load transactions from Nessie as they work differently
      if (tarjetaDigital?.tipo === 'Credit Card') {
        console.log('💳 Credit card detected - skipping transaction loading');
        setMovements([]);
        return;
      }

      if (tarjetaDigital?.nessieAccountId) {
        try {
          console.log('📥 INITIAL LOAD - Loading transactions for card:', tarjetaDigital.nessieAccountId);
          // Get purchases, deposits and transfers
          const [purchases, deposits, transfers] = await Promise.all([
            getAccountPurchases(tarjetaDigital.nessieAccountId),
            getAccountDeposits(tarjetaDigital.nessieAccountId),
            getAccountTransfers(tarjetaDigital.nessieAccountId)
          ]);

          console.log('📦 INITIAL LOAD - API Response:');
          console.log('  🛒 Purchases:', purchases.length);
          console.log('  💵 Deposits:', deposits.length);
          console.log('  ✈️ Transfers:', transfers.length);

          // Combine and format transactions
          const formattedMovements = [];

          // Format purchases (expenses)
          purchases.forEach(purchase => {
            console.log('🛒 INITIAL - Processing purchase:', {
              id: purchase._id,
              desc: purchase.description,
              status: purchase.status,
              amount: purchase.amount
            });
            formattedMovements.push({
              id: purchase._id,
          type: 'gasto',
              description: purchase.description || 'Purchase',
              amount: -Math.abs(purchase.amount), // Negative for expenses
              date: purchase.purchase_date,
              time: '12:00', // Nessie doesn't provide time, use default
              category: 'Purchase',
              icon: 'shopping-cart',
              status: purchase.status
            });
          });

          // Format deposits (income)
          deposits.forEach(deposit => {
            console.log('💵 INITIAL - Processing deposit:', deposit._id);
            formattedMovements.push({
              id: deposit._id,
          type: 'ingreso',
              description: deposit.description || 'Deposit',
              amount: Math.abs(deposit.amount), // Positive for income
              date: deposit.transaction_date,
              time: '12:00', // Nessie doesn't provide time, use default
              category: 'Deposit',
              icon: 'dollar-sign',
              status: deposit.status
            });
          });

          // Format transfers
          transfers.forEach(transfer => {
            // Determinar correctamente si es ingreso o gasto basado en payer/payee
            const isIncoming = tarjetaDigital.nessieAccountId === transfer.payee_id;
            const isOutgoing = tarjetaDigital.nessieAccountId === transfer.payer_id;
            console.log('✈️ INITIAL - Processing transfer:', {
              id: transfer._id,
              isIncoming,
              isOutgoing
            });
            formattedMovements.push({
              id: transfer._id,
              type: isIncoming ? 'transfer_in' : 'transfer_out',
              description: transfer.description || (isIncoming ? 'Money Received' : 'Money Sent'),
              amount: isIncoming ? Math.abs(transfer.amount) : -Math.abs(transfer.amount),
              date: transfer.transaction_date,
              time: '12:00', // Nessie doesn't provide time, use default
              category: 'Transfer',
              icon: 'paper-plane',
              status: transfer.status
            });
          });

          // Sort by date (most recent first)
          formattedMovements.sort((a, b) => new Date(b.date) - new Date(a.date));

          console.log('✅ INITIAL LOAD - Total formatted movements:', formattedMovements.length);
          console.log('📋 INITIAL LOAD - All movements:', formattedMovements.map(m => ({ type: m.type, desc: m.description })));

          setMovements(formattedMovements);
        } catch (error) {
          console.error('❌ INITIAL LOAD - Error loading transactions from Nessie API:', error);
          // Fallback to empty array
          setMovements([]);
        }
      } else {
        console.log('⚠️ No nessieAccountId found for card');
        setMovements([]);
      }
    };

    if (tarjetaDigital) {
      loadTransactions();
    }
  }, [tarjetaDigital]);

  // Refresh data when dataRefreshTrigger changes (e.g., after a purchase)
  useEffect(() => {
    console.log('🔔 Data refresh triggered:', dataRefreshTrigger);
    if (!tarjetaDigital || dataRefreshTrigger === 0) return;

    const refreshData = async () => {
      // For credit cards, only refresh balance, not transactions
      if (tarjetaDigital.tipo === 'Credit Card') {
        if (tarjetaDigital.nessieAccountId) {
          try {
            console.log('🔄 Refreshing credit card balance...');
            const balance = await getAccountBalance(tarjetaDigital.nessieAccountId);
            console.log('💰 Updated credit card balance:', balance);
            setAccountBalance(balance);
          } catch (error) {
            console.error('❌ Error refreshing credit card balance:', error);
          }
        }
        return;
      }

      if (tarjetaDigital.nessieAccountId) {
        try {
          console.log('🔄 Refreshing balance and transactions...');
          
          // Load updated balance
          const balance = await getAccountBalance(tarjetaDigital.nessieAccountId);
          console.log('💰 Updated balance:', balance);
          setAccountBalance(balance);

          // Load updated transactions
          const [purchases, deposits, transfers] = await Promise.all([
            getAccountPurchases(tarjetaDigital.nessieAccountId),
            getAccountDeposits(tarjetaDigital.nessieAccountId),
            getAccountTransfers(tarjetaDigital.nessieAccountId)
          ]);

          console.log('📦 API Response - Purchases:', purchases.length, 'Deposits:', deposits.length, 'Transfers:', transfers.length);

          // Combine and format transactions
          const formattedMovements = [];

          // Format purchases (expenses)
          purchases.forEach(purchase => {
            console.log('🛒 Processing purchase:', {
              id: purchase._id,
              desc: purchase.description,
              status: purchase.status,
              amount: purchase.amount,
              date: purchase.purchase_date
            });
            formattedMovements.push({
              id: purchase._id,
              type: 'gasto',
              description: purchase.description || 'Purchase',
              amount: -Math.abs(purchase.amount), // Negative for expenses
              date: purchase.purchase_date,
              time: '12:00', // Nessie doesn't provide time, use default
              category: 'Purchase',
              icon: 'shopping-cart',
              status: purchase.status
            });
          });

          // Format deposits (income)
          deposits.forEach(deposit => {
            console.log('💵 Processing deposit:', deposit._id, deposit.description);
            formattedMovements.push({
              id: deposit._id,
              type: 'ingreso',
              description: deposit.description || 'Deposit',
              amount: Math.abs(deposit.amount), // Positive for income
              date: deposit.transaction_date,
              time: '12:00', // Nessie doesn't provide time, use default
              category: 'Deposit',
              icon: 'dollar-sign',
              status: deposit.status
            });
          });

          // Format transfers
          transfers.forEach(transfer => {
            // Determinar correctamente si es ingreso o gasto basado en payer/payee
            const isIncoming = tarjetaDigital.nessieAccountId === transfer.payee_id;
            const isOutgoing = tarjetaDigital.nessieAccountId === transfer.payer_id;
            console.log('✈️ Processing transfer:', {
              id: transfer._id,
              isIncoming,
              isOutgoing,
              payer: transfer.payer_id,
              payee: transfer.payee_id,
              myAccount: tarjetaDigital.nessieAccountId
            });
            formattedMovements.push({
              id: transfer._id,
              type: isIncoming ? 'transfer_in' : 'transfer_out',
              description: transfer.description || (isIncoming ? 'Money Received' : 'Money Sent'),
              amount: isIncoming ? Math.abs(transfer.amount) : -Math.abs(transfer.amount),
              date: transfer.transaction_date,
              time: '12:00', // Nessie doesn't provide time, use default
              category: 'Transfer',
              icon: 'paper-plane',
              status: transfer.status
            });
          });

          // Sort by date (most recent first)
          formattedMovements.sort((a, b) => new Date(b.date) - new Date(a.date));

          console.log('✅ Total formatted movements:', formattedMovements.length);
          console.log('📋 All movements:', formattedMovements.map(m => ({ type: m.type, desc: m.description, amount: m.amount })));

          setMovements(formattedMovements);
        } catch (error) {
          console.error('❌ Error refreshing transactions from Nessie API:', error);
        }
      }
    };

    refreshData();
  }, [dataRefreshTrigger, tarjetaDigital]);

  // Combinar movimientos reales con transacciones optimistas
  const allMovements = [...movements, ...optimisticTransactions];

  // Mostrar transferencias y purchases para savings accounts
  const filteredMovements = allMovements.filter(movement =>
    movement.type === 'transfer_in' || movement.type === 'transfer_out' || movement.type === 'gasto'
  );


  // Copiar CLABE al portapapeles
  const copyCLABE = async () => {
    if (tarjetaDigital?.clabe) {
      await Clipboard.setStringAsync(tarjetaDigital.clabe);
      Alert.alert('Copied', 'CLABE copied to clipboard');
    } else {
      Alert.alert('Error', 'Could not copy CLABE');
    }
  };

  // Copiar número de tarjeta al portapapeles
  const copyCardNumber = async () => {
    if (tarjetaDigital?.numeroTarjeta) {
      await Clipboard.setStringAsync(tarjetaDigital.numeroTarjeta);
      Alert.alert('Copied', 'Card number copied to clipboard');
    } else {
      Alert.alert('Error', 'Could not copy card number');
    }
  };

  // Formatear CLABE para mostrar
  const formatCLABE = (clabe) => {
    if (!clabe || typeof clabe !== 'string') return '';
    return clabe.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // Formatear número de tarjeta para mostrar
  const formatCardNumber = (cardNumber) => {
    if (!cardNumber || typeof cardNumber !== 'string') return '';
    return cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // Si no hay tarjeta digital, no renderizar
  if (!tarjetaDigital) {
    return null;
  }

  return (
    <SafeAreaView style={styles.screenContainer}>
      <StatusBar style="dark" />

      {/* Header con botón de back */}
      <View style={styles.screenHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={20} color="#004977" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>
          {cardType ? `${cardType.toUpperCase()} CARD` : 'DIGITAL CARD'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        bounces={true}
      >

        {/* Contenedor blanco con bordes redondeados */}
        <View style={styles.whiteContainer}>
          {/* Tarjeta Principal */}
          <View style={styles.cardPreview}>
            <View style={[styles.card, { backgroundColor: cardColors.solid }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardLogo}>
                  <Icon name="credit-card" size={20} color="#fff" />
                  <Text style={styles.cardTypeText}>{tarjetaDigital?.nickname || cardTypeLabel || 'DEBIT'}</Text>
                </View>
                <View style={styles.cardTagRow}>
                  <Text style={styles.cardTag}>
                    {cardType ? `${cardType.toUpperCase()} CARD` : 'DIGITAL CARD'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardNumberRow}>
                  <Text style={styles.cardNumber}>
                    {showCardNumber
                      ? formatCardNumber(tarjetaDigital?.numeroTarjeta)
                      : `${tarjetaDigital?.numeroTarjeta?.slice(0, 4)} ${tarjetaDigital?.numeroTarjeta?.slice(4, 7)}****`
                    }
                  </Text>
                  <TouchableOpacity
                    style={styles.copyIconButton}
                    onPress={copyCardNumber}
                  >
                    <Icon name="copy" size={16} color="#007AFF" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.cardHolderName}>
                  {tarjetaDigital?.nombreTitular}
                </Text>

                <View style={styles.cardBottomRow}>
                  <View>
                    <Text style={styles.cardLabel}>EXPIRATION</Text>
                    <Text style={styles.cardValue}>{tarjetaDigital?.fechaExpiracion}</Text>
                  </View>
                  <View>
                    <Text style={styles.cardLabel}>CVV</Text>
                    <TouchableOpacity
                      style={styles.cvvButton}
                      onPress={() => setShowCvv(!showCvv)}
                    >
                      <Text style={styles.cardValue}>
                        {showCvv ? tarjetaDigital?.cvv : '***'}
                      </Text>
                      <Icon
                        name={showCvv ? 'eye-slash' : 'eye'}
                        size={14}
                        color="#fff"
                        style={{ marginLeft: 6 }}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Saldo Disponible */}
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>Available</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceAmount}>
                $ {showBalance ? accountBalance.toFixed(2) : '****'}
              </Text>
              <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
                <Icon name={showBalance ? 'eye' : 'eye-slash'} size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Transaction Filters - Only show for debit cards */}
          {tarjetaDigital?.tipo !== 'Credit Card' && (
            <View style={styles.filtersSection}>
              <Text style={styles.filtersTitle}>Transactions</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContainer}
              >
              <View style={styles.filterButtons}>
                <TouchableOpacity
                  style={[styles.filterButton, activeFilter === 'todos' && styles.filterButtonActive]}
                  onPress={() => setActiveFilter('todos')}
                >
                  <Text style={[styles.filterButtonText, activeFilter === 'todos' && styles.filterButtonTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, activeFilter === 'purchases' && styles.filterButtonActive]}
                    onPress={() => setActiveFilter('purchases')}
                  >
                    <Text style={[styles.filterButtonText, activeFilter === 'purchases' && styles.filterButtonTextActive]}>
                      Purchases
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, activeFilter === 'transactions' && styles.filterButtonActive]}
                    onPress={() => setActiveFilter('transactions')}
                  >
                    <Text style={[styles.filterButtonText, activeFilter === 'transactions' && styles.filterButtonTextActive]}>
                      Transfers
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterButton, activeFilter === 'ingresos' && styles.filterButtonActive]}
                  onPress={() => setActiveFilter('ingresos')}
                >
                  <Text style={[styles.filterButtonText, activeFilter === 'ingresos' && styles.filterButtonTextActive]}>
                      Income
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterButton, activeFilter === 'gastos' && styles.filterButtonActive]}
                  onPress={() => setActiveFilter('gastos')}
                >
                  <Text style={[styles.filterButtonText, activeFilter === 'gastos' && styles.filterButtonTextActive]}>
                      Expenses
                  </Text>
                </TouchableOpacity>
              </View>
              </ScrollView>
            </View>
          )}

          {/* Credit Card Info - Only show for credit cards */}
          {tarjetaDigital?.tipo === 'Credit Card' && (
            <View style={styles.filtersSection}>
              <Text style={styles.filtersTitle}>Card Information</Text>
              <View style={styles.creditCardInfo}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Credit Limit</Text>
                  <Text style={styles.infoValue}>$7,000.00</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Available Credit</Text>
                  <Text style={styles.infoValue}>${(accountBalance || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Used Credit</Text>
                  <Text style={styles.infoValue}>${((7000 - (accountBalance || 0))).toFixed(2)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Due Date</Text>
                  <Text style={styles.infoValue}>Nov 13</Text>
                </View>
              </View>
            </View>
          )}
          {/* Savings Growth Projection - Only for Savings Accounts */}
          {tarjetaDigital?.tipo?.toLowerCase().includes('savings') && (
            <SavingsProjectionSection balance={accountBalance} />
          )}

          {/* Monthly Balance Chart */}
          <MonthlyBalanceChart movements={filteredMovements} />

          {/* Activity History */}
          <View style={styles.filtersSection}>
            <Text style={styles.filtersTitle}>Activity History</Text>
          </View>

          {/* Lista de Movimientos / Información de Tarjeta */}
          {tarjetaDigital?.tipo !== 'Credit Card' && (
            <View style={styles.movementsList}>
            {filteredMovements.length === 0 ? (
              <View style={styles.noMovementsContainer}>
                <Icon name="receipt" size={32} color="#ccc" />
                <Text style={styles.noMovementsText}>No activity yet</Text>
              </View>
            ) : (
              filteredMovements.map((movement) => (
                <View key={movement.id} style={styles.movementItem}>
                  <View style={styles.movementLeft}>
                    <View style={[styles.movementIcon, {
                      backgroundColor:
                        movement.type === 'ingreso' || movement.type === 'transfer_in' ? '#E8F5E8' :
                        movement.type === 'gasto' || movement.type === 'transfer_out' ? '#FFEBEE' : '#F0F0F0'
                    }]}>
                      <Icon
                        name={movement.icon}
                        size={16}
                        color={
                          movement.type === 'ingreso' || movement.type === 'transfer_in' ? '#4CAF50' :
                          movement.type === 'gasto' || movement.type === 'transfer_out' ? '#F44336' : '#666'
                        }
                      />
                    </View>
                    <View style={styles.movementDetails}>
                      <Text style={styles.movementDescription}>{movement.description}</Text>
                      <Text style={styles.movementCategory}>{movement.category} • {movement.time}</Text>
                    </View>
                  </View>
                  <View style={styles.movementRight}>
                    <Text style={[styles.movementAmount, {
                      color:
                        movement.type === 'ingreso' || movement.type === 'transfer_in' ? '#4CAF50' :
                        movement.type === 'gasto' || movement.type === 'transfer_out' ? '#F44336' : '#666'
                    }]}>
                      {movement.type === 'ingreso' || movement.type === 'transfer_in' ? '+' : ''}${Math.abs(movement.amount).toFixed(2)}
                    </Text>
                    <Text style={styles.movementDate}>{movement.date}</Text>
                  </View>
                </View>
              ))
            )}
            </View>
          )}

          {/* Credit Card Placeholder */}
          {tarjetaDigital?.tipo === 'Credit Card' && (
            <View style={styles.movementsList}>
              <View style={styles.noMovementsContainer}>
                <Icon name="credit-card" size={32} color="#ccc" />
                <Text style={styles.noMovementsText}>No transactions available for credit cards</Text>
                <Text style={styles.creditCardNote}>Credit card statements will be available soon</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSpacing(20),
    paddingVertical: scaleSpacing(15),
    backgroundColor: '#fff',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 36,
  },
  scrollContent: {
    paddingBottom: scaleSpacing(30),
  },
  closeArea: {
    height: scaleSpacing(60),
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: scaleSpacing(20),
    borderTopRightRadius: scaleSpacing(20),
  },
  closeIndicator: {
    width: scaleSpacing(40),
    height: scaleSpacing(4),
    backgroundColor: '#CCCCCC',
    borderRadius: scaleSpacing(2),
  },
  whiteContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: scaleSpacing(16),
    borderTopRightRadius: scaleSpacing(16),
    marginTop: 0,
    paddingTop: scaleSpacing(20),
    paddingHorizontal: scaleSpacing(20),
  },
  cardPreview: {
    marginBottom: scaleSpacing(20),
  },
  card: {
    borderRadius: scaleSpacing(16),
    padding: scaleSpacing(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 200,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTypeText: {
    color: '#fff',
    fontSize: scaleFont(11),
    fontWeight: '600',
  },
  cardTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    color: '#fff',
    fontSize: scaleFont(11),
    fontWeight: '500',
  },
  cardTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardTypeBadgeText: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  cardBody: {
    flex: 1,
  },
  cardNumberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardNumber: {
    color: '#fff',
    fontSize: scaleFont(20),
    fontWeight: '600',
    letterSpacing: 2,
  },
  copyIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  cardHolderName: {
    color: '#fff',
    fontSize: scaleFont(16),
    fontWeight: '600',
    marginBottom: 16,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: scaleFont(10),
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardValue: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  cvvButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceSection: {
    marginBottom: scaleSpacing(24),
  },
  balanceLabel: {
    fontSize: scaleFont(14),
    color: '#666',
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceAmount: {
    fontSize: scaleFont(32),
    fontWeight: 'bold',
    color: '#333',
  },
  // Filtros y Movimientos
  filtersSection: {
    marginBottom: scaleSpacing(20),
  },
  filtersTitle: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: scaleSpacing(12),
  },
  filterScrollContainer: {
    paddingVertical: scaleSpacing(4),
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: scaleSpacing(20), // Espacio extra al final del scroll
  },
  filterButton: {
    paddingHorizontal: scaleSpacing(16),
    paddingVertical: scaleSpacing(8),
    borderRadius: scaleSpacing(20),
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 80,
    alignItems: 'center',
    flexShrink: 0, // Evita que los botones se encojan
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: scaleFont(12),
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  movementsList: {
    marginBottom: scaleSpacing(20),
  },
  movementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleSpacing(12),
    paddingHorizontal: scaleSpacing(4),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  movementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  movementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleSpacing(12),
  },
  movementDetails: {
    flex: 1,
  },
  movementDescription: {
    fontSize: scaleFont(16),
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  movementCategory: {
    fontSize: scaleFont(12),
    color: '#666',
  },
  movementRight: {
    alignItems: 'flex-end',
  },
  movementAmount: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    marginBottom: 2,
  },
  movementDate: {
    fontSize: scaleFont(12),
    color: '#666',
  },
  noMovementsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: scaleSpacing(12),
    marginBottom: scaleSpacing(20),
  },
  noMovementsText: {
    fontSize: scaleFont(16),
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
  },
  creditCardNote: {
    fontSize: scaleFont(12),
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  creditCardInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
    marginTop: scaleSpacing(12),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleSpacing(8),
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  infoLabel: {
    fontSize: scaleFont(14),
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: scaleFont(14),
    color: '#1a1a1a',
    fontWeight: '600',
  },
  movementsSection: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: scaleSpacing(20),
    paddingTop: scaleSpacing(20),
  },
  movementsTitle: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyMovements: {
    backgroundColor: '#fff',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(40),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: scaleFont(14),
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  quickActionsSection: {
    marginTop: scaleSpacing(20),
    marginBottom: scaleSpacing(10),
  },
  quickActionsTitle: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: scaleSpacing(12),
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: scaleSpacing(12),
  },
  quickActionButton: {
    backgroundColor: '#fff',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
    flex: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  quickActionIcon: {
    width: scaleSpacing(40),
    height: scaleSpacing(40),
    borderRadius: scaleSpacing(20),
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleSpacing(8),
  },
  quickActionText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },

  // Savings Projection Styles
  projectionSection: {
    marginTop: scaleSpacing(20),
    marginBottom: scaleSpacing(10),
    backgroundColor: '#fff',
    borderRadius: scaleSpacing(16),
    padding: scaleSpacing(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  projectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSpacing(8),
    gap: scaleSpacing(8),
  },
  projectionTitle: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  projectionSubtitle: {
    fontSize: scaleFont(14),
    color: '#666',
    marginBottom: scaleSpacing(20),
    lineHeight: scaleFont(20),
  },
  growthSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
    marginBottom: scaleSpacing(20),
  },
  growthRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  growthItem: {
    alignItems: 'center',
    minWidth: scaleSpacing(80),
  },
  growthLabel: {
    fontSize: scaleFont(11),
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scaleSpacing(2),
  },
  growthAmount: {
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: '#1a1a1a',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: scaleSpacing(24),
    paddingBottom: scaleSpacing(8),
  },
  chart: {
    borderRadius: scaleSpacing(12),
    paddingRight: scaleSpacing(30),
    paddingBottom: scaleSpacing(20),
  },
  projectionNote: {
    fontSize: scaleFont(12),
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: scaleFont(16),
  },
  // Estilos para Monthly Balance Chart
  monthlyChartSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: scaleSpacing(16),
    padding: scaleSpacing(20),
    marginBottom: scaleSpacing(20),
  },
  monthlyChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSpacing(16),
  },
  monthlyChartTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: scaleSpacing(8),
  },
  monthlyChartContent: {
    alignItems: 'center',
  },
  flowSummary: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
    marginBottom: scaleSpacing(20),
    width: '100%',
    justifyContent: 'space-around',
  },
  flowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flowIconContainer: {
    width: scaleSpacing(32),
    height: scaleSpacing(32),
    borderRadius: scaleSpacing(16),
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scaleSpacing(8),
  },
  flowTextContainer: {
    flex: 1,
  },
  flowLabel: {
    fontSize: scaleFont(12),
    color: '#666',
    fontWeight: '500',
    marginBottom: scaleSpacing(2),
  },
  flowAmount: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#1a1a1a',
  },
  flowDivider: {
    width: 1,
    height: scaleSpacing(40),
    backgroundColor: '#E0E0E0',
    marginHorizontal: scaleSpacing(12),
  },
  barChartContainer: {
    alignItems: 'center',
    marginBottom: scaleSpacing(16),
  },
  barChart: {
    borderRadius: scaleSpacing(8),
  },
  netFlowContainer: {
    alignItems: 'center',
    paddingVertical: scaleSpacing(8),
    paddingHorizontal: scaleSpacing(16),
    backgroundColor: '#ffffff',
    borderRadius: scaleSpacing(8),
    minWidth: scaleSpacing(120),
  },
  netFlowLabel: {
    fontSize: scaleFont(12),
    color: '#666',
    fontWeight: '500',
    marginBottom: scaleSpacing(2),
  },
  netFlowAmount: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: '#1a1a1a',
  },
});

export default TarjetaDigitalDetails;
