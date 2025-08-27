import { Text, View } from 'react-native';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
  tipTitle?: string;
  tipText?: string;
  iconBgColor?: string;
  iconColor?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  subtitle, 
  tipTitle, 
  tipText,
  iconBgColor = '#f0f8ff',
  iconColor = '#2f95dc'
}: EmptyStateProps) {
  return (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 32,
      minHeight: 400 // Ensure minimum height for proper centering
    }}>
      {/* Icon placeholder */}
      <View style={{ 
        width: 80, 
        height: 80, 
        borderRadius: 40, 
        backgroundColor: iconBgColor, 
        alignItems: 'center', 
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <Text style={{ fontSize: 32, color: iconColor }}>{icon}</Text>
      </View>
      
      {/* Main message */}
      <Text style={{ 
        fontSize: 20, 
        fontWeight: '700', 
        marginBottom: 12, 
        textAlign: 'center',
        color: '#333'
      }}>
        {title}
      </Text>
      
      {/* Subtitle */}
      <Text style={{ 
        color: '#666', 
        textAlign: 'center', 
        fontSize: 16,
        lineHeight: 22,
        marginBottom: 32,
        paddingHorizontal: 20
      }}>
        {subtitle}
      </Text>
      
      {/* Optional tip */}
      {tipTitle && tipText && (
        <View style={{ 
          backgroundColor: '#f8f9fa', 
          padding: 16, 
          borderRadius: 12, 
          borderWidth: 1, 
          borderColor: '#e9ecef',
          alignItems: 'center',
          maxWidth: 300
        }}>
          <Text style={{ 
            fontSize: 14, 
            color: '#495057', 
            fontWeight: '600',
            marginBottom: 4
          }}>
            {tipTitle}
          </Text>
          <Text style={{ 
            fontSize: 13, 
            color: '#6c757d', 
            textAlign: 'center',
            lineHeight: 18
          }}>
            {tipText}
          </Text>
        </View>
      )}
    </View>
  );
}
