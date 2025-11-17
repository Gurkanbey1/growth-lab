import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1') => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportCompanyDetailToExcel = (company: any, projects: any[], revenues: any[], expenses: any[], domains: any[]) => {
  const wb = XLSX.utils.book_new();

  // Company info sheet
  const companyData = [{
    'Firma Adı': company.name,
    'Tip': company.type,
    'Email': company.email || '-',
    'Telefon': company.phone || '-',
    'Adres': company.address || '-',
    'Vergi No': company.tax_number || '-',
  }];
  const wsCompany = XLSX.utils.json_to_sheet(companyData);
  XLSX.utils.book_append_sheet(wb, wsCompany, 'Firma Bilgileri');

  // Projects sheet
  if (projects && projects.length > 0) {
    const projectsData = projects.map(p => ({
      'Proje Adı': p.name,
      'Durum': p.status,
      'Bütçe (TL)': p.budget,
      'Ödenen (TL)': p.paid_amount,
      'Kalan (TL)': p.remaining_amount || 0,
      'Atanan': p.profiles?.full_name || '-',
    }));
    const wsProjects = XLSX.utils.json_to_sheet(projectsData);
    XLSX.utils.book_append_sheet(wb, wsProjects, 'Projeler');
  }

  // Revenues sheet
  if (revenues && revenues.length > 0) {
    const revenuesData = revenues.map(r => ({
      'Açıklama': r.description,
      'Fatura No': r.invoice_number || '-',
      'Tutar (TL)': r.amount,
      'Tarih': new Date(r.revenue_date).toLocaleDateString('tr-TR'),
    }));
    const wsRevenues = XLSX.utils.json_to_sheet(revenuesData);
    XLSX.utils.book_append_sheet(wb, wsRevenues, 'Gelirler');
  }

  // Expenses sheet
  if (expenses && expenses.length > 0) {
    const expensesData = expenses.map(e => ({
      'Açıklama': e.description,
      'Kategori': e.category || '-',
      'Tutar (TL)': e.amount,
      'Sıklık': e.frequency,
      'Durum': e.is_active ? 'Aktif' : 'Pasif',
    }));
    const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Giderler');
  }

  // Domains sheet
  if (domains && domains.length > 0) {
    const domainsData = domains.map(d => ({
      'Domain Adı': d.domain_name,
      'Tip': d.type,
      'Registrar': d.registrar || '-',
      'Başlangıç': d.start_date ? new Date(d.start_date).toLocaleDateString('tr-TR') : '-',
      'Bitiş': new Date(d.expire_date).toLocaleDateString('tr-TR'),
    }));
    const wsDomains = XLSX.utils.json_to_sheet(domainsData);
    XLSX.utils.book_append_sheet(wb, wsDomains, 'Domainler');
  }

  XLSX.writeFile(wb, `${company.name}_Rapor.xlsx`);
};

export const exportCompanyDetailToPDF = (company: any, projects: any[], revenues: any[], expenses: any[], domains: any[]) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text(`${company.name} - Firma Raporu`, 14, 20);
  
  // Company info
  doc.setFontSize(12);
  doc.text('Firma Bilgileri', 14, 35);
  doc.setFontSize(10);
  let yPos = 45;
  doc.text(`Tip: ${company.type}`, 14, yPos);
  yPos += 7;
  if (company.email) {
    doc.text(`Email: ${company.email}`, 14, yPos);
    yPos += 7;
  }
  if (company.phone) {
    doc.text(`Telefon: ${company.phone}`, 14, yPos);
    yPos += 7;
  }
  if (company.tax_number) {
    doc.text(`Vergi No: ${company.tax_number}`, 14, yPos);
    yPos += 7;
  }

  // Summary
  const totalDebt = projects?.reduce((sum, p) => sum + ((p.budget || 0) - (p.paid_amount || 0)), 0) || 0;
  const totalRevenue = revenues?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  const totalExpense = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

  yPos += 10;
  doc.setFontSize(12);
  doc.text('Özet', 14, yPos);
  doc.setFontSize(10);
  yPos += 10;
  doc.text(`Toplam Borç: ${totalDebt.toLocaleString('tr-TR')} TL`, 14, yPos);
  yPos += 7;
  doc.text(`Toplam Gelir: ${totalRevenue.toLocaleString('tr-TR')} TL`, 14, yPos);
  yPos += 7;
  doc.text(`Toplam Gider: ${totalExpense.toLocaleString('tr-TR')} TL`, 14, yPos);
  yPos += 7;
  doc.text(`Domain Sayısı: ${domains?.length || 0}`, 14, yPos);

  // Projects table
  if (projects && projects.length > 0) {
    yPos += 15;
    doc.setFontSize(12);
    doc.text('Projeler', 14, yPos);
    yPos += 5;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Proje Adı', 'Durum', 'Bütçe', 'Ödenen', 'Kalan']],
      body: projects.map(p => [
        p.name,
        p.status,
        `${p.budget.toLocaleString('tr-TR')} TL`,
        `${p.paid_amount.toLocaleString('tr-TR')} TL`,
        `${(p.remaining_amount || 0).toLocaleString('tr-TR')} TL`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
    });
  }

  doc.save(`${company.name}_Rapor.pdf`);
};
