/**
 * AddressSearch Component
 * Google Places Autocomplete wrapper with Robinhood Dark theme
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Feather } from '@expo/vector-icons';

interface AddressSearchProps {
  onSelect: (address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  }) => void;
  placeholder?: string;
  value?: string;
}

export default function AddressSearch({
  onSelect,
  placeholder = 'Enter your address',
  value,
}: AddressSearchProps) {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

  if (!googleMapsApiKey) {
    console.warn('EXPO_PUBLIC_GOOGLE_MAPS_KEY is not set');
  }

  return (
    <View style={styles.container}>
      <GooglePlacesAutocomplete
        placeholder={placeholder}
        onPress={(data, details = null) => {
          if (details) {
            // Parse address components
            const addressComponents = details.address_components || [];
            let street = '';
            let city = '';
            let state = '';
            let zip = '';

            addressComponents.forEach((component) => {
              const types = component.types;

              if (types.includes('street_number')) {
                street = component.long_name + ' ';
              }
              if (types.includes('route')) {
                street += component.long_name;
              }
              if (types.includes('locality')) {
                city = component.long_name;
              }
              if (types.includes('administrative_area_level_1')) {
                state = component.short_name; // Use short code (e.g., "CA")
              }
              if (types.includes('postal_code')) {
                zip = component.long_name;
              }
            })

            // Fallback to formatted_address if components are missing
            if (!street && details.formatted_address) {
              street = details.formatted_address;
            }

            onSelect({
              street: street.trim(),
              city: city.trim(),
              state: state.trim(),
              zip: zip.trim(),
            });
          }
        }}
        query={{
          key: googleMapsApiKey,
          language: 'en',
          components: 'country:us', // Restrict to US addresses
        }}
        fetchDetails={true}
        enablePoweredByContainer={false}
        disableScroll={true}
        listViewDisplayed="auto"
        keepResultsAfterBlur={true}
        styles={{
          container: styles.autocompleteContainer,
          textInputContainer: { backgroundColor: 'transparent' },
          textInput: {
            backgroundColor: '#FFFFFF',
            color: '#000000',
            borderRadius: 8,
            height: 50,
            fontSize: 16,
            paddingHorizontal: 16,
          },
          listView: {
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            marginTop: 10,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '#E5E5EA',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
            maxHeight: 300,
          },
          row: {
            backgroundColor: '#FFFFFF',
            padding: 16,
            height: 'auto',
            flexDirection: 'row',
            alignItems: 'center',
          },
          separator: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: '#E5E5EA',
          },
          description: {
            color: '#000000',
            fontSize: 16,
            fontWeight: '400',
            flex: 1,
          },
          predefinedPlacesDescription: {
            color: '#636366',
            fontSize: 14,
          },
        }}
        textInputProps={{
          placeholderTextColor: '#636366',
          returnKeyType: 'search',
        }}
        renderLeftButton={() => (
          <View style={styles.leftIconContainer}>
            <Feather name="map-pin" size={20} color="#636366" />
          </View>
        )}
        debounce={300}
        minLength={2}
        nearbyPlacesAPI="GooglePlacesSearch"
        GooglePlacesSearchQuery={{
          rankby: 'distance',
        }}
        filterReverseGeocodingByTypes={['locality', 'administrative_area_level_3']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  autocompleteContainer: {
    flex: 0,
    width: '100%',
    zIndex: 1000,
  },
  leftIconContainer: {
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
