import { PrismaClient } from '@prisma/client';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import puppeteer from 'puppeteer';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel } from 'docx';
import fs from 'fs/promises';
import path from 'path';
import {
  Report,
  ReportSection,
  ReportTemplate,
  ReportExportOptions,
  StatisticalTable,
  AnalysisResult,
  ReportVersion,
  ReportCollaborator
} from '../types/report-models.js';

const prisma = new PrismaClient();

export class ReportService {
  private templates: Map<string, string> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private async initializeTemplates() {
    // Load default templates
    const defaultTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{title}}</title>
    <style>
        body { font-family: 'Times New Roman', serif; margin: 1in; line-height: 1.6; }
        h1 { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 24pt; }
        h2 { font-size: 14pt; font-weight: bold; margin-top: 24pt; margin-bottom: 12pt; }
        h3 { font-size: 12pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; }
        p { font-size: 12pt; margin-bottom: 12pt; text-align: justify; }
        table { border-collapse: collapse; margin: 12pt 0; width: 100%; }
        th, td { border: 1px solid #000; padding: 6pt; text-align: left; }
        th { background-color: #f0f0f0; font-weight: bold; }
        .statistical-table { margin: 12pt auto; }
        .chart-container { text-align: center; margin: 12pt 0; }
        .apa-table-number { font-weight: bold; font-style: italic; }
        .apa-table-title { font-weight: bold; margin-bottom: 6pt; }
        .apa-table-note { font-size: 10pt; font-style: italic; margin-top: 6pt; }
        .significance { font-weight: bold; }
        .page-break { page-break-before: always; }
    </style>
</head>
<body>
    <h1>{{title}}</h1>
    {{#if description}}
    <p>{{description}}</p>
    {{/if}}
    
    {{#each sections}}
    <div class="section" data-section-id="{{id}}">
        {{#if pageBreakBefore}}
        <div class="page-break"></div>
        {{/if}}
        
        {{#if title}}
        <h{{level}}>{{title}}</h{{level}}>
        {{/if}}
        
        {{#if (eq type 'text')}}
        <div class="text-content">{{{content}}}</div>
        {{/if}}
        
        {{#if (eq type 'analysis')}}
        <div class="analysis-content">
            {{#if content.summary}}
            <p>{{content.summary}}</p>
            {{/if}}
            
            {{#each content.tables}}
            <div class="statistical-table">
                {{#if title}}
                <div class="apa-table-number">Table {{@index}}.</div>
                <div class="apa-table-title">{{title}}</div>
                {{/if}}
                <table>
                    <thead>
                        <tr>
                            {{#each headers}}
                            <th>{{this}}</th>
                            {{/each}}
                        </tr>
                    </thead>
                    <tbody>
                        {{#each rows}}
                        <tr>
                            {{#each this}}
                            <td>{{this}}</td>
                            {{/each}}
                        </tr>
                        {{/each}}
                    </tbody>
                </table>
                {{#if notes}}
                <div class="apa-table-note">
                    {{#each notes}}
                    <p>{{this}}</p>
                    {{/each}}
                </div>
                {{/if}}
            </div>
            {{/each}}
            
            {{#if content.interpretation}}
            <p><strong>Interpretation:</strong> {{content.interpretation}}</p>
            {{/if}}
        </div>
        {{/if}}
        
        {{#if (eq type 'visualization')}}
        <div class="chart-container">
            {{#if title}}
            <h3>{{title}}</h3>
            {{/if}}
            <div class="chart-placeholder" data-chart-id="{{content.id}}">
                [Chart: {{content.title}}]
            </div>
            {{#if content.caption}}
            <p><em>{{content.caption}}</em></p>
            {{/if}}
        </div>
        {{/if}}
        
        {{#if (eq type 'table')}}
        <div class="table-content">
            {{#if title}}
            <h3>{{title}}</h3>
            {{/if}}
            <table>
                <thead>
                    <tr>
                        {{#each content.headers}}
                        <th>{{this}}</th>
                        {{/each}}
                    </tr>
                </thead>
                <tbody>
                    {{#each content.rows}}
                    <tr>
                        {{#each this}}
                        <td>{{this}}</td>
                        {{/each}}
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </div>
        {{/if}}
    </div>
    {{/each}}
</body>
</html>`;

    this.templates.set('default', defaultTemplate);
    
    // Register Handlebars helpers
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('level', function(this: any) {
      return this.level || 2;
    });
  }

  async createReport(data: {
    title: string;
    description?: string;
    projectId: string;
    userId: string;
    templateId?: string;
    sections?: ReportSection[];
  }): Promise<Report> {
    const template = await this.getTemplate(data.templateId);
    
    const report = await prisma.report.create({
      data: {
        title: data.title,
        description: data.description,
        sections: data.sections || [],
        templateId: data.templateId,
        userId: data.userId,
        projectId: data.projectId,
        version: 1
      },
      include: {
        template: true,
        collaborators: true,
        user: true,
        project: true
      }
    });

    // Create initial version
    await this.createVersion(report.id, data.userId, 'Initial version');

    // Log activity
    await this.logActivity(report.id, data.userId, 'CREATED', 'Report created');

    return this.mapPrismaReportToReport(report);
  }

  async updateReport(
    reportId: string,
    userId: string,
    updates: {
      title?: string;
      description?: string;
      sections?: ReportSection[];
    }
  ): Promise<Report> {
    const existingReport = await prisma.report.findUnique({
      where: { id: reportId },
      include: { template: true, collaborators: true, user: true, project: true }
    });

    if (!existingReport) {
      throw new Error('Report not found');
    }

    // Check permissions
    await this.checkEditPermission(reportId, userId);

    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        ...updates,
        version: existingReport.version + 1,
        updatedAt: new Date()
      },
      include: {
        template: true,
        collaborators: true,
        user: true,
        project: true
      }
    });

    // Create new version
    await this.createVersion(reportId, userId, 'Report updated');

    // Log activity
    await this.logActivity(reportId, userId, 'UPDATED', 'Report updated');

    return this.mapPrismaReportToReport(updatedReport);
  }

  async generateFromAnalysis(
    analysisId: string,
    userId: string,
    projectId: string,
    options: {
      title: string;
      templateId?: string;
      includeCharts?: boolean;
      includeRawData?: boolean;
    }
  ): Promise<Report> {
    // Get analysis results
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        dataset: true,
        visualizations: true
      }
    });

    if (!analysis) {
      throw new Error('Analysis not found');
    }

    // Generate report sections from analysis
    const sections = await this.generateSectionsFromAnalysis(analysis, options);

    return this.createReport({
      title: options.title,
      description: `Automated report generated from ${analysis.name} analysis`,
      projectId,
      userId,
      templateId: options.templateId,
      sections
    });
  }

  async exportReport(
    reportId: string,
    userId: string,
    options: ReportExportOptions
  ): Promise<Buffer> {
    const report = await this.getReport(reportId, userId);
    
    // Check export permission
    await this.checkExportPermission(reportId, userId);

    const html = await this.renderReportHTML(report, options);

    switch (options.format) {
      case 'pdf':
        return this.exportToPDF(html, options);
      case 'docx':
        return this.exportToDocx(report, options);
      case 'html':
        return Buffer.from(html, 'utf-8');
      default:
        throw new Error('Unsupported export format');
    }
  }

  private async exportToPDF(html: string, options: ReportExportOptions): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '1in',
          bottom: '1in',
          left: '1in',
          right: '1in'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="date"></span></div>',
        footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="pageNumber"></span> of <span class="totalPages"></span></div>'
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private async exportToDocx(report: Report, options: ReportExportOptions): Promise<Buffer> {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: report.title,
            heading: HeadingLevel.TITLE,
            alignment: 'center'
          }),
          ...(report.description ? [
            new Paragraph({
              text: report.description,
              spacing: { after: 200 }
            })
          ] : []),
          ...this.convertSectionsToDocx(report.sections, options)
        ]
      }]
    });

    return await Packer.toBuffer(doc);
  }

  private convertSectionsToDocx(sections: ReportSection[], options: ReportExportOptions): any[] {
    const docxElements: any[] = [];

    for (const section of sections) {
      if (section.title) {
        docxElements.push(
          new Paragraph({
            text: section.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        );
      }

      switch (section.type) {
        case 'text':
          if (typeof section.content === 'string') {
            docxElements.push(
              new Paragraph({
                text: section.content,
                spacing: { after: 100 }
              })
            );
          }
          break;

        case 'table':
          if (section.content.headers && section.content.rows) {
            const table = new Table({
              rows: [
                new TableRow({
                  children: section.content.headers.map((header: string) =>
                    new TableCell({
                      children: [new Paragraph(header)]
                    })
                  )
                }),
                ...section.content.rows.map((row: any[]) =>
                  new TableRow({
                    children: row.map(cell =>
                      new TableCell({
                        children: [new Paragraph(String(cell))]
                      })
                    )
                  })
                )
              ]
            });
            docxElements.push(table);
          }
          break;

        case 'analysis':
          if (section.content.summary) {
            docxElements.push(
              new Paragraph({
                text: section.content.summary,
                spacing: { after: 100 }
              })
            );
          }
          break;
      }
    }

    return docxElements;
  }

  private async renderReportHTML(report: Report, options: ReportExportOptions): Promise<string> {
    const template = this.templates.get('default') || '';
    const compiledTemplate = Handlebars.compile(template);

    // Process sections for rendering
    const processedSections = await Promise.all(
      report.sections.map(async (section) => {
        const processedSection = { ...section };

        if (section.type === 'text' && typeof section.content === 'string') {
          // Convert markdown to HTML
          processedSection.content = marked(section.content);
        }

        if (section.type === 'analysis' && options.applyAPAFormatting) {
          processedSection.content = this.applyAPAFormatting(section.content);
        }

        return processedSection;
      })
    );

    return compiledTemplate({
      title: report.title,
      description: report.description,
      sections: processedSections
    });
  }

  private applyAPAFormatting(content: any): any {
    if (content.tables) {
      content.tables = content.tables.map((table: StatisticalTable, index: number) => ({
        ...table,
        title: table.title || `Statistical Results ${index + 1}`,
        formatting: {
          ...table.formatting,
          applyAPA: true,
          decimalPlaces: table.formatting?.decimalPlaces || 3,
          significanceMarkers: true
        }
      }));
    }

    return content;
  }

  async addCollaborator(
    reportId: string,
    userId: string,
    collaboratorUserId: string,
    role: 'viewer' | 'editor' | 'admin'
  ): Promise<void> {
    // Check admin permission
    await this.checkAdminPermission(reportId, userId);

    const permissions = {
      canEdit: role === 'editor' || role === 'admin',
      canComment: true,
      canExport: role === 'editor' || role === 'admin',
      canShare: role === 'admin'
    };

    await prisma.reportCollaborator.create({
      data: {
        userId: collaboratorUserId,
        reportId,
        role: role.toUpperCase() as any,
        permissions
      }
    });

    await this.logActivity(reportId, userId, 'COLLABORATOR_ADDED', `Added collaborator with ${role} role`);
  }

  async createVersion(reportId: string, userId: string, changeLog: string): Promise<ReportVersion> {
    const report = await prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      throw new Error('Report not found');
    }

    const version = await prisma.reportVersion.create({
      data: {
        reportId,
        version: report.version,
        title: report.title,
        sections: report.sections,
        createdBy: userId,
        changeLog
      }
    });

    await this.logActivity(reportId, userId, 'VERSION_CREATED', `Version ${version.version} created`);

    return {
      id: version.id,
      reportId: version.reportId,
      version: version.version,
      title: version.title,
      sections: version.sections as ReportSection[],
      createdBy: version.createdBy,
      createdAt: version.createdAt,
      changeLog: version.changeLog || ''
    };
  }

  async getReportVersions(reportId: string, userId: string): Promise<ReportVersion[]> {
    await this.checkViewPermission(reportId, userId);

    const versions = await prisma.reportVersion.findMany({
      where: { reportId },
      orderBy: { version: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return versions.map(version => ({
      id: version.id,
      reportId: version.reportId,
      version: version.version,
      title: version.title,
      sections: version.sections as ReportSection[],
      createdBy: version.createdBy,
      createdAt: version.createdAt,
      changeLog: version.changeLog || ''
    }));
  }

  private async generateSectionsFromAnalysis(analysis: any, options: any): Promise<ReportSection[]> {
    const sections: ReportSection[] = [];

    // Introduction section
    sections.push({
      id: 'intro',
      type: 'text',
      title: 'Introduction',
      content: `This report presents the results of ${analysis.type} analysis performed on the dataset "${analysis.dataset.name}".`,
      order: 1,
      formatting: {}
    });

    // Methods section
    sections.push({
      id: 'methods',
      type: 'text',
      title: 'Methods',
      content: this.generateMethodsText(analysis),
      order: 2,
      formatting: {}
    });

    // Results section
    if (analysis.results) {
      sections.push({
        id: 'results',
        type: 'analysis',
        title: 'Results',
        content: analysis.results,
        order: 3,
        formatting: {}
      });
    }

    // Visualizations section
    if (options.includeCharts && analysis.visualizations.length > 0) {
      analysis.visualizations.forEach((viz: any, index: number) => {
        sections.push({
          id: `viz-${index}`,
          type: 'visualization',
          title: viz.name,
          content: {
            id: viz.id,
            title: viz.name,
            type: viz.type,
            config: viz.config
          },
          order: 4 + index,
          formatting: {}
        });
      });
    }

    return sections;
  }

  private generateMethodsText(analysis: any): string {
    const methods = [`Analysis Type: ${analysis.type}`];
    
    if (analysis.parameters) {
      methods.push(`Parameters: ${JSON.stringify(analysis.parameters, null, 2)}`);
    }

    return methods.join('\n\n');
  }

  private async getTemplate(templateId?: string): Promise<ReportTemplate | null> {
    if (!templateId) return null;

    const template = await prisma.reportTemplate.findUnique({
      where: { id: templateId }
    });

    return template ? {
      id: template.id,
      name: template.name,
      description: template.description || '',
      sections: template.sections as any[],
      styling: template.styling as any,
      isDefault: template.isDefault
    } : null;
  }

  private async getReport(reportId: string, userId: string): Promise<Report> {
    await this.checkViewPermission(reportId, userId);

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        template: true,
        collaborators: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        user: true,
        project: true
      }
    });

    if (!report) {
      throw new Error('Report not found');
    }

    return this.mapPrismaReportToReport(report);
  }

  private mapPrismaReportToReport(prismaReport: any): Report {
    return {
      id: prismaReport.id,
      title: prismaReport.title,
      description: prismaReport.description,
      projectId: prismaReport.projectId,
      userId: prismaReport.userId,
      sections: prismaReport.sections as ReportSection[],
      template: prismaReport.template ? {
        id: prismaReport.template.id,
        name: prismaReport.template.name,
        description: prismaReport.template.description || '',
        sections: prismaReport.template.sections as any[],
        styling: prismaReport.template.styling as any,
        isDefault: prismaReport.template.isDefault
      } : {} as ReportTemplate,
      version: prismaReport.version,
      createdAt: prismaReport.createdAt,
      updatedAt: prismaReport.updatedAt,
      isPublic: prismaReport.isPublic,
      collaborators: prismaReport.collaborators?.map((collab: any) => ({
        userId: collab.userId,
        role: collab.role.toLowerCase(),
        permissions: collab.permissions,
        joinedAt: collab.joinedAt
      })) || []
    };
  }

  private async checkViewPermission(reportId: string, userId: string): Promise<void> {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        collaborators: true
      }
    });

    if (!report) {
      throw new Error('Report not found');
    }

    if (report.userId === userId || report.isPublic) {
      return;
    }

    const collaboration = report.collaborators.find(c => c.userId === userId);
    if (!collaboration) {
      throw new Error('Access denied');
    }
  }

  private async checkEditPermission(reportId: string, userId: string): Promise<void> {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        collaborators: true
      }
    });

    if (!report) {
      throw new Error('Report not found');
    }

    if (report.userId === userId) {
      return;
    }

    const collaboration = report.collaborators.find(c => c.userId === userId);
    if (!collaboration || !collaboration.permissions || !(collaboration.permissions as any).canEdit) {
      throw new Error('Edit permission denied');
    }
  }

  private async checkExportPermission(reportId: string, userId: string): Promise<void> {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        collaborators: true
      }
    });

    if (!report) {
      throw new Error('Report not found');
    }

    if (report.userId === userId) {
      return;
    }

    const collaboration = report.collaborators.find(c => c.userId === userId);
    if (!collaboration || !collaboration.permissions || !(collaboration.permissions as any).canExport) {
      throw new Error('Export permission denied');
    }
  }

  private async checkAdminPermission(reportId: string, userId: string): Promise<void> {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        collaborators: true
      }
    });

    if (!report) {
      throw new Error('Report not found');
    }

    if (report.userId === userId) {
      return;
    }

    const collaboration = report.collaborators.find(c => c.userId === userId);
    if (!collaboration || collaboration.role !== 'ADMIN') {
      throw new Error('Admin permission required');
    }
  }

  private async logActivity(
    reportId: string,
    userId: string,
    action: 'CREATED' | 'UPDATED' | 'COMMENTED' | 'EXPORTED' | 'SHARED' | 'VERSION_CREATED' | 'COLLABORATOR_ADDED' | 'COLLABORATOR_REMOVED',
    details: string
  ): Promise<void> {
    await prisma.reportActivity.create({
      data: {
        reportId,
        userId,
        action,
        details
      }
    });
  }
}

export const reportService = new ReportService();