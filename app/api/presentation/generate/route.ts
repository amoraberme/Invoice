import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const invoiceJson = formData.get('invoiceData') as string | null
    const customPrompt = (formData.get('customPrompt') as string) || ''
    const template = (formData.get('template') as string) || 'modern_solar'
    const slideCount = (formData.get('slideCount') as string) || '8'
    const presentonUrlInput = (formData.get('presentonUrl') as string) || ''
    const presentonKeyInput = (formData.get('presentonKey') as string) || ''

    let invoice: any = null
    if (invoiceJson) {
      try {
        invoice = JSON.parse(invoiceJson)
      } catch {
        invoice = null
      }
    }

    // Determine target Presenton API endpoint and Key
    const targetUrl = (
      presentonUrlInput ||
      process.env.PRESENTON_API_URL ||
      'https://api.presenton.ai'
    ).replace(/\/$/, '')

    const targetKey = presentonKeyInput || process.env.PRESENTON_API_KEY || ''

    // Assemble high-conversion solar proposal instructions
    const clientName = invoice?.toName || 'Valued Client'
    const clientAddress = invoice?.toAddress || 'Philippines'
    const systemSize = invoice?.activeKwSetup || 5
    const isHybrid = invoice?.systemType !== 'ongrid'
    const systemTitle = `${systemSize}kW ${isHybrid ? 'Hybrid Solar System' : 'Grid-Tied Solar System'}`

    const componentBullets = (invoice?.lineItems || [])
      .slice(0, 15)
      .map((it: any) => `• ${it.quantity}x ${it.description} (${it.unit || 'PC'})`)
      .join('\n')

    const warrantyBullets = (invoice?.warranties || [])
      .map((w: any) => `• ${w.component}: ${w.coverage} (${w.warrantyType})`)
      .join('\n')

    const systemPrompt = `
You are an elite residential and commercial solar proposal presentation designer for MG Solar Philippines.
Create a high-impact, professional ${slideCount}-slide Solar Energy Proposal & Financial ROI Presentation for:
- Client Name: ${clientName}
- Project Site: ${clientAddress}
- System Architecture: ${systemTitle}
- Estimated Total Investment: PHP ${(invoice?.total || 0).toLocaleString()}

System Components & Technical Bill of Materials:
${componentBullets || 'Tier-1 High-Efficiency N-Type TOPCon Panels, Smart Hybrid Inverter, Balance of System'}

Comprehensive Warranty Guarantees:
${warrantyBullets || '15-Year Panel Warranty, 5-10 Year Inverter & Battery Storage Warranty, 2-Year Installation Services'}

Strategic Presentation Structure:
1. Cover / Executive Title Slide: Customized for ${clientName} with sleek solar aesthetics.
2. The Problem & Utility Rate Crisis: Rising Meralco/Electric cooperative bills, grid red/yellow alerts, brownout vulnerabilities.
3. Tailored Engineering Solution: Introduction of the ${systemTitle} with daily generation capacity.
4. Key Equipment Deep-Dive: Tier-1 N-Type solar panels, high-efficiency hybrid inverter, and smart lithium storage.
5. Scope of Work & Execution Milestones: Professional engineering design, structural mounting, electrical cabling, testing, commissioning, and net metering assistance.
6. Financial Analysis & Payback: 70% to 85% daytime electric bill reduction, estimated 3 to 4.5 year return on investment (ROI).
7. Safety, Protections & Multi-Year Warranties: Tier-1 manufacturer coverage, SPD surge protection, DC/AC breakers, 2-year dedicated workmanship support.
8. Call to Action & Sign-off: Simple handover timeline, project kick-off checklist, contact details.

Specific User Instructions & Custom Directives:
${customPrompt ? customPrompt : 'Focus on energy independence, monthly savings, and worry-free grid protection.'}
    `.trim()

    // Dispatch to Presenton API
    const outgoingFormData = new FormData()
    outgoingFormData.append('prompt', systemPrompt)
    outgoingFormData.append('export_format', 'pptx')
    outgoingFormData.append('template', template)
    outgoingFormData.append('slide_count', slideCount)

    if (file && file.size > 0) {
      outgoingFormData.append('document', file, file.name)
    }

    const headers: Record<string, string> = {}
    if (targetKey) {
      headers['Authorization'] = `Bearer ${targetKey}`
    }

    // Call Presenton generate endpoint
    const response = await fetch(`${targetUrl}/api/v3/presentation/generate`, {
      method: 'POST',
      headers,
      body: outgoingFormData,
    })

    if (!response.ok) {
      const errorMsg = await response.text()
      return NextResponse.json(
        {
          error: `Presenton API responded with status ${response.status}: ${errorMsg}`,
          targetUrl,
          fallbackPrompt: systemPrompt
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({
      success: true,
      data,
      compiledPrompt: systemPrompt,
      clientName,
      systemTitle
    })
  } catch (error: any) {
    console.error('Presenton generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process presentation generation request' },
      { status: 500 }
    )
  }
}
