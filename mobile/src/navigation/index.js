import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import RegisterBusinessScreen from '../screens/RegisterBusinessScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ProductsScreen from '../screens/ProductsScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import PurchaseOrdersScreen from '../screens/PurchaseOrdersScreen';
import PurchaseOrderDetailScreen from '../screens/PurchaseOrderDetailScreen';
import PurchaseOrderCreateScreen from '../screens/PurchaseOrderCreateScreen';
import ReceiveInventoryScreen from '../screens/ReceiveInventoryScreen';
import ScanPOScreen from '../screens/ScanPOScreen';
import ScanReviewScreen from '../screens/ScanReviewScreen';
import POSScreen from '../screens/POSScreen';
import SalesHistoryScreen from '../screens/SalesHistoryScreen';
import SaleDetailScreen from '../screens/SaleDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WebExportConfigScreen from '../screens/WebExportConfigScreen';
import WebListingsScreen from '../screens/WebListingsScreen';

const AuthStackNav = createNativeStackNavigator();
const RootStackNav = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="RegisterBusiness" component={RegisterBusinessScreen} />
    </AuthStackNav.Navigator>
  );
}

function DashboardStack() {
  return (
    <RootStackNav.Navigator screenOptions={screenOptions}>
      <RootStackNav.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'L&H Poultry' }} />
    </RootStackNav.Navigator>
  );
}

function ProductsStack() {
  return (
    <RootStackNav.Navigator screenOptions={screenOptions}>
      <RootStackNav.Screen name="ProductsList" component={ProductsScreen} options={{ title: 'Products' }} />
      <RootStackNav.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Product' }} />
      <RootStackNav.Screen name="WebListings" component={WebListingsScreen} options={{ title: 'Web listings' }} />
    </RootStackNav.Navigator>
  );
}

function PurchaseOrdersStack() {
  return (
    <RootStackNav.Navigator screenOptions={screenOptions}>
      <RootStackNav.Screen name="PurchaseOrdersList" component={PurchaseOrdersScreen} options={{ title: 'Purchase Orders' }} />
      <RootStackNav.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} options={{ title: 'Purchase Order' }} />
      <RootStackNav.Screen name="PurchaseOrderCreate" component={PurchaseOrderCreateScreen} options={{ title: 'New Purchase Order' }} />
      <RootStackNav.Screen name="ReceiveInventory" component={ReceiveInventoryScreen} options={{ title: 'Receive Inventory' }} />
      <RootStackNav.Screen name="ScanPO" component={ScanPOScreen} options={{ title: 'Scan Purchase Order' }} />
      <RootStackNav.Screen name="ScanReview" component={ScanReviewScreen} options={{ title: 'Review Scan' }} />
    </RootStackNav.Navigator>
  );
}

function POSStack() {
  return (
    <RootStackNav.Navigator screenOptions={screenOptions}>
      <RootStackNav.Screen name="Checkout" component={POSScreen} options={{ title: 'Point of Sale' }} />
      <RootStackNav.Screen name="SaleDetail" component={SaleDetailScreen} options={{ title: 'Receipt' }} />
    </RootStackNav.Navigator>
  );
}

function SalesStack() {
  return (
    <RootStackNav.Navigator screenOptions={screenOptions}>
      <RootStackNav.Screen name="SalesHistoryList" component={SalesHistoryScreen} options={{ title: 'Sales History' }} />
      <RootStackNav.Screen name="SaleDetail" component={SaleDetailScreen} options={{ title: 'Receipt' }} />
    </RootStackNav.Navigator>
  );
}

function SettingsStack() {
  return (
    <RootStackNav.Navigator screenOptions={screenOptions}>
      <RootStackNav.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
      <RootStackNav.Screen name="WebExportConfig" component={WebExportConfigScreen} options={{ title: 'Web Export Destination' }} />
    </RootStackNav.Navigator>
  );
}

function MainTabs() {
  const { hasRole } = useAuth();

  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="DashboardTab" component={DashboardStack} options={{ title: 'Home' }} />
      <Tabs.Screen name="POSTab" component={POSStack} options={{ title: 'Sell' }} />
      <Tabs.Screen name="ProductsTab" component={ProductsStack} options={{ title: 'Products' }} />
      {hasRole('MANAGER') && (
        <Tabs.Screen name="PurchaseOrdersTab" component={PurchaseOrdersStack} options={{ title: 'Purchasing' }} />
      )}
      <Tabs.Screen name="SalesTab" component={SalesStack} options={{ title: 'Sales' }} />
      {hasRole('OWNER') && <Tabs.Screen name="SettingsTab" component={SettingsStack} options={{ title: 'Settings' }} />}
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <NavigationContainer>{user ? <MainTabs /> : <AuthStack />}</NavigationContainer>;
}
