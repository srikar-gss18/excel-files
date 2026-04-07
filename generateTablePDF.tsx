import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

export interface PDFColumn<T> {
  key: keyof T | string;
  title: string;
  width?: number;
  render?: (value: unknown, row: T) => string;
}

interface PDFTableConfig {
  title?: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'A3' | 'LETTER' | 'LEGAL';
  fontSize?: number;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  alternateRowColor?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  timestamp: {
    fontSize: 8,
    color: '#888',
    textAlign: 'right',
    marginBottom: 10,
  },
  table: {
    display: 'flex',
    width: '100%',
    border: '1px solid #DFE5EC',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#186483',
    minHeight: 30,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 25,
  },
  tableRowEven: {
    backgroundColor: '#ffffff',
  },
  tableRowOdd: {
    backgroundColor: '#f5f6f8',
  },
  tableCell: {
    padding: 6,
    borderRight: '1px solid #DFE5EC',
    borderBottom: '1px solid #DFE5EC',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  tableCellLast: {
    borderRight: 'none',
  },
  tableCellText: {
    fontSize: 8,
    color: '#363636',
    textAlign: 'center',
  },
  tableHeaderCell: {
    padding: 6,
    borderRight: '1px solid #ffffff',
    borderBottom: '1px solid #DFE5EC',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  tableHeaderCellLast: {
    borderRight: 'none',
  },
  tableHeaderCellText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#888',
  },
});

interface PDFTableDocumentProps<T> {
  data: T[];
  columns: PDFColumn<T>[];
  config?: PDFTableConfig;
}

function PDFTableDocument<T extends Record<string, unknown>>({
  data,
  columns,
  config = {},
}: PDFTableDocumentProps<T>) {
  const {
    title = 'Report',
    orientation = 'landscape',
    pageSize = 'A4',
    headerBackgroundColor = '#343a40',
    headerTextColor = '#ffffff',
    alternateRowColor = '#f8f9fa',
  } = config;

  const defaultWidth = 100 / columns.length;

  const getCellValue = (row: T, column: PDFColumn<T>): string => {
    const value = row[column.key as keyof T];
    if (column.render) {
      return column.render(value, row);
    }
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <Document>
      <Page size={pageSize} orientation={orientation} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableHeaderRow, { backgroundColor: headerBackgroundColor }]}>
            {columns.map((column, index) => (
              <View
                key={`header-${index}`}
                style={[
                  styles.tableCell,
                  { width: `${column.width || defaultWidth}%` },
                  ...(index === columns.length - 1 ? [{ borderRightWidth: 0 }] : []),
                ]}
              >
                <Text style={[styles.tableHeaderCellText, { color: headerTextColor }]}>
                  {column.title}
                </Text>
              </View>
            ))}
          </View>

          {/* Table Rows */}
          {data.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[
                styles.tableRow,
                ...(rowIndex % 2 === 1 ? [{ backgroundColor: alternateRowColor }] : []),
                ...(rowIndex === data.length - 1 ? [{ borderBottomWidth: 0 }] : []),
              ]}
            >
              {columns.map((column, colIndex) => (
                <View
                  key={`cell-${rowIndex}-${colIndex}`}
                  style={[
                    styles.tableCell,
                    { width: `${column.width || defaultWidth}%` },
                    ...(colIndex === columns.length - 1 ? [{ borderRightWidth: 0 }] : []),
                  ]}
                >
                  <Text style={styles.tableCellText}>{getCellValue(row, column)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

async function generateTablePDF<T extends Record<string, unknown>>(
  data: T[],
  columns: PDFColumn<T>[],
  filename: string,
  config?: PDFTableConfig
): Promise<void> {
  const blob = await pdf(
    <PDFTableDocument data={data} columns={columns} config={config} />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default generateTablePDF;