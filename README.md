# Tip Tracker 📊

A comprehensive mobile app for restaurant workers to track their shifts, tips, wages, and generate insights to optimize their earnings.

## 🎯 What is Tip Tracker?

Tip Tracker helps restaurant servers, bartenders, and other tipped workers:
- **Track every shift** with detailed tip breakdowns
- **Calculate earnings** including tips, wages, and tip-outs
- **Analyze performance** with charts and insights
- **Optimize schedules** by identifying your best days and shifts

## ✨ Features

### 📝 Shift Tracking
- **Easy data entry** for cash tips, card tips, hours worked, and base wages
- **Flexible tip-out calculations** (percentage of tips or sales)
- **Optional overrides** for custom tip-out amounts
- **Notes and tags** for shift context (e.g., "#busy #tourists")

### 📊 Analytics & Insights
- **Real-time calculations** showing net tips, effective hourly rate, and gross earnings
- **Performance trends** with daily and weekly charts
- **Best shift analysis** to identify your most profitable days and times
- **Filtering options** by date range (7d, 30d, all time) and shift type

### 🔧 Smart Features
- **Persistent settings** for default tip-out percentages and basis
- **Remember last wage** to speed up data entry
- **CSV export/import** for data backup and migration
- **Cross-platform** works on iOS, Android, and web

### 🎨 User Experience
- **Clean, intuitive interface** designed for quick data entry
- **Empty states** with helpful guidance for new users
- **Swipe-to-delete** with undo functionality
- **Responsive design** that works on all screen sizes

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tip-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on your preferred platform**
   - **Web**: Press `w` in the terminal or visit `http://localhost:8081`
   - **iOS Simulator**: Press `i` (requires Xcode)
   - **Android Emulator**: Press `a` (requires Android Studio)
   - **Physical device**: Scan the QR code with Expo Go app

## 📱 How to Use

### Adding Your First Shift

1. **Navigate to "Add Shift" tab**
2. **Enter shift details**:
   - Date and shift type (Brunch/Lunch/Dinner)
   - Hours worked and base hourly wage
   - Cash tips and card tips received
   - Tip-out percentage and basis (tips vs sales)
3. **Review live calculations** showing your earnings
4. **Save the shift** - it's automatically added to your history

### Viewing Your History

- **History tab** shows all your shifts in chronological order
- **Tap any shift** to view details or edit
- **Swipe left** to delete shifts (with undo option)
- **Pull to refresh** to sync latest data

### Analyzing Your Performance

- **Insights tab** provides comprehensive analytics
- **Filter by date range** to focus on specific periods
- **View charts** showing your earning trends
- **Identify patterns** in your best performing shifts

### Managing Your Data

- **Settings tab** for app preferences and data management
- **Export to CSV** for backup or tax purposes
- **Import CSV** to restore data or migrate from other apps
- **Seed sample data** to explore features with demo data

## 🛠️ Technical Details

### Built With
- **React Native** with Expo for cross-platform development
- **Expo Router** for file-based navigation
- **SQLite** (mobile) / AsyncStorage (web) for data persistence
- **Victory Native** for charts and visualizations
- **TypeScript** for type safety

### Project Structure
```
tip-tracker/
├── app/                    # Main app screens (Expo Router)
│   ├── (tabs)/            # Tab-based navigation
│   │   ├── add-shift.tsx  # Shift entry form
│   │   ├── history.tsx    # Shift history list
│   │   ├── insights.tsx   # Analytics and charts
│   │   └── settings.tsx   # App settings
│   └── shift/             # Individual shift details
├── components/            # Reusable UI components
├── data/                  # Database and business logic
├── hooks/                 # Custom React hooks
└── constants/             # App constants and themes
```

### Data Schema
Each shift record includes:
- Date, shift type, hours worked
- Cash tips, card tips, base wage
- Tip-out percentage and basis
- Optional sales amount and override
- Notes and metadata

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/) for seamless cross-platform development
- Charts powered by [Victory](https://formidable.com/open-source/victory/)
- Icons from [Expo Vector Icons](https://icons.expo.fyi/)

---

**Made with ❤️ for restaurant workers everywhere**
