```mermaid
erDiagram

        MachineType {
            lab_analyzer lab_analyzer
radiology_equipment radiology_equipment
vital_signs_monitor vital_signs_monitor
        }
    


        ConnectionType {
            hl7 hl7
astm astm
rest_api rest_api
file_upload file_upload
serial serial
        }
    


        ConnectionStatus {
            connected connected
disconnected disconnected
error error
        }
    


        QueueStatus {
            pending pending
matched matched
imported imported
failed failed
manual_review manual_review
        }
    


        LogType {
            connection connection
result_import result_import
error error
config_change config_change
        }
    


        InvitationStatus {
            pending pending
accepted accepted
expired expired
cancelled cancelled
        }
    
  "Organization" {
    String id "🗝️"
    String name 
    String slug 
    String logoUrl "❓"
    String primaryColor 
    String secondaryColor 
    String email "❓"
    String phone "❓"
    String address "❓"
    String city "❓"
    String region "❓"
    String country 
    String settings 
    String subscriptionTier 
    String subscriptionStatus 
    DateTime subscriptionStartedAt "❓"
    DateTime subscriptionEndsAt "❓"
    String modulesEnabled 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "User" {
    String id "🗝️"
    String organizationId 
    String email 
    String passwordHash "❓"
    String fullName 
    String phone "❓"
    DateTime dateOfBirth "❓"
    String gender "❓"
    String address "❓"
    String employeeId "❓"
    String role 
    String departmentId "❓"
    String specialization "❓"
    String licenseNumber "❓"
    Boolean isActive 
    DateTime lastLoginAt "❓"
    String preferences "❓"
    String defaultCalendar 
    String invitationToken "❓"
    DateTime invitationExpiresAt "❓"
    String invitedById "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "Department" {
    String id "🗝️"
    String organizationId 
    String name 
    String code "❓"
    String description "❓"
    String headId "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Patient" {
    String id "🗝️"
    String organizationId 
    String mrn 
    String externalId "❓"
    String firstName 
    String middleName "❓"
    String lastName 
    DateTime dateOfBirth 
    String gender 
    String bloodGroup "❓"
    String phonePrimary "❓"
    String phoneSecondary "❓"
    String email "❓"
    String region "❓"
    String zone "❓"
    String woreda "❓"
    String kebele "❓"
    String houseNumber "❓"
    String emergencyContactName "❓"
    String emergencyContactPhone "❓"
    String emergencyContactRelationship "❓"
    String allergies "❓"
    String chronicConditions "❓"
    String currentMedications "❓"
    Boolean hasInsurance 
    String insuranceProvider "❓"
    String insuranceId "❓"
    DateTime insuranceExpiryDate "❓"
    String insuranceCoverageDetails "❓"
    String photoUrl "❓"
    String maritalStatus "❓"
    String occupation "❓"
    String educationLevel "❓"
    Boolean isActive 
    Boolean isVip 
    String notes "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    String updatedById "❓"
    }
  

  "PreTriage" {
    String id "🗝️"
    String organizationId 
    String screeningNumber 
    String firstName "❓"
    String lastName "❓"
    Int age "❓"
    String gender "❓"
    String phone "❓"
    String chiefComplaint "❓"
    String briefHistory "❓"
    Float temperature "❓"
    Int bloodPressureSystolic "❓"
    Int bloodPressureDiastolic "❓"
    Int pulseRate "❓"
    Int respiratoryRate "❓"
    Float spo2 "❓"
    Float weight "❓"
    Float height "❓"
    Float bmi "❓"
    Float fbs "❓"
    Float ppbs "❓"
    String routedTo "❓"
    String status 
    String patientId "❓"
    DateTime screenedAt 
    String screenedById "❓"
    DateTime routedAt "❓"
    String routedById "❓"
    }
  

  "QueueManagement" {
    String id "🗝️"
    String organizationId 
    String patientId "❓"
    String serviceArea 
    String serviceType "❓"
    String queueNumber 
    String priority 
    String assignedToId "❓"
    String assignedRoom "❓"
    String status 
    DateTime joinedQueueAt 
    DateTime calledAt "❓"
    DateTime serviceStartedAt "❓"
    DateTime serviceCompletedAt "❓"
    Int estimatedWaitMinutes "❓"
    String displayMessage "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "TriageAssessment" {
    String id "🗝️"
    String organizationId 
    String patientId 
    String appointmentId "❓"
    String triageType 
    String etatPriority "❓"
    String etatCategory "❓"
    String urgencyLevel "❓"
    String chiefComplaint "❓"
    Float temperature "❓"
    Int bloodPressureSystolic "❓"
    Int bloodPressureDiastolic "❓"
    Int pulseRate "❓"
    Int respiratoryRate "❓"
    Int oxygenSaturation "❓"
    Float weight "❓"
    Float height "❓"
    Int ageMonths "❓"
    Float muac "❓"
    Boolean edema 
    Boolean unableToDrink 
    Boolean vomitingEverything 
    Boolean convulsions 
    Boolean lethargicUnconscious 
    Int pregnancyWeeks "❓"
    Int gravida "❓"
    Int para "❓"
    DateTime lastMenstrualPeriod "❓"
    String mentalStatus "❓"
    Boolean suicidalIdeation 
    Boolean violentBehavior 
    Boolean substanceUse 
    String triageNotes "❓"
    String triageCategory "❓"
    String recommendedService "❓"
    String triagedById "❓"
    DateTime triagedAt 
    DateTime createdAt 
    }
  

  "Appointment" {
    String id "🗝️"
    String organizationId 
    String patientId 
    String doctorId "❓"
    DateTime appointmentDate 
    String appointmentTime 
    Int durationMinutes 
    String appointmentType "❓"
    String departmentId "❓"
    String priority 
    String status 
    String chiefComplaint "❓"
    String notes "❓"
    String consultationNotes "❓"
    DateTime checkedInAt "❓"
    String checkedInById "❓"
    DateTime startedAt "❓"
    DateTime completedAt "❓"
    DateTime cancelledAt "❓"
    String cancelledById "❓"
    String cancellationReason "❓"
    String rescheduledFromId "❓"
    String rescheduledToId "❓"
    Boolean reminderSent 
    DateTime reminderSentAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "Consultation" {
    String id "🗝️"
    String organizationId 
    String patientId 
    String appointmentId "❓"
    String doctorId 
    DateTime visitDate 
    String visitType "❓"
    Float temperature "❓"
    Int bloodPressureSystolic "❓"
    Int bloodPressureDiastolic "❓"
    Int pulseRate "❓"
    Int respiratoryRate "❓"
    Float weight "❓"
    Float height "❓"
    Int oxygenSaturation "❓"
    String chiefComplaint "❓"
    String historyOfPresentIllness "❓"
    String physicalExamination "❓"
    String diagnosis "❓"
    String icd10Codes "❓"
    String treatmentPlan "❓"
    String followUpInstructions "❓"
    DateTime followUpDate "❓"
    String referredTo "❓"
    String referralReason "❓"
    String notes "❓"
    String attachments "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "Ward" {
    String id "🗝️"
    String organizationId 
    String departmentId "❓"
    String name 
    String code "❓"
    String type "❓"
    Int capacity 
    String floor "❓"
    String chargeNurse "❓"
    String phone "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Bed" {
    String id "🗝️"
    String organizationId 
    String wardId 
    String bedNumber 
    String type "❓"
    String status 
    String currentPatientId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Admission" {
    String id "🗝️"
    String organizationId 
    String patientId 
    String bedId "❓"
    DateTime admissionDate 
    String admissionType "❓"
    String admissionReason "❓"
    String admissionDiagnosis "❓"
    String chiefComplaint "❓"
    Int expectedLengthOfStay "❓"
    Float depositAmount "❓"
    String admissionNotes "❓"
    Boolean isCritical 
    String admittingDoctorId "❓"
    String attendingDoctorId "❓"
    String status 
    DateTime dischargeDate "❓"
    String dischargeReason "❓"
    String dischargeDiagnosis "❓"
    String dischargeSummary "❓"
    String treatmentSummary "❓"
    String dischargeCondition "❓"
    String medicationsOnDischarge "❓"
    String dischargeNotes "❓"
    String followUpInstructions "❓"
    String dischargeDoctorId "❓"
    DateTime followUpDate "❓"
    String followUpNotes "❓"
    String clinicalNotes "❓"
    Float dailyRoomRate "❓"
    Float totalBillAmount "❓"
    Boolean billGenerated 
    String additionalCharges "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "DeathCertificate" {
    String id "🗝️"
    String organizationId 
    String patientId 
    String certificateNumber 
    DateTime dateOfDeath 
    String timeOfDeath "❓"
    String placeOfDeath 
    String locationDetails "❓"
    Int ageAtDeathYears "❓"
    Int ageAtDeathMonths "❓"
    Int ageAtDeathDays "❓"
    String sex 
    String maritalStatus "❓"
    String occupation "❓"
    String address "❓"
    String immediateCause 
    String antecedentCauseB "❓"
    String antecedentCauseC "❓"
    String antecedentCauseD "❓"
    String otherConditions "❓"
    String mannerOfDeath 
    Boolean autopsyPerformed 
    String autopsyFindings "❓"
    Boolean isMaternalDeath 
    String pregnancyRelated "❓"
    String certifiedById "❓"
    DateTime certificationDate 
    String certifierQualification "❓"
    String licenseNumber "❓"
    String signatureUrl "❓"
    String issuedTo "❓"
    String issuedToRelationship "❓"
    String issuedToNationalId "❓"
    DateTime issuedAt "❓"
    String issuedById "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "PharmacyDrug" {
    String id "🗝️"
    String organizationId 
    String drugName 
    String genericName "❓"
    String brandName "❓"
    String drugCode "❓"
    String drugCategory "❓"
    String dosageForm "❓"
    String strength "❓"
    Int quantityInStock 
    String unitOfMeasure "❓"
    Int reorderLevel 
    Int maximumStockLevel "❓"
    Float costPrice "❓"
    Float sellingPrice "❓"
    Float markupPercentage "❓"
    String storageLocation "❓"
    Boolean requiresPrescription 
    String supplierName "❓"
    String supplierContact "❓"
    String description "❓"
    String sideEffects "❓"
    String contraindications "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "PharmacyBatch" {
    String id "🗝️"
    String organizationId 
    String drugId 
    String batchNumber 
    DateTime manufactureDate "❓"
    DateTime expiryDate 
    Int quantityReceived 
    Int quantityRemaining 
    String purchaseOrderNumber "❓"
    DateTime purchaseDate "❓"
    Float costPricePerUnit "❓"
    Float totalCost "❓"
    String supplierName "❓"
    String supplierInvoice "❓"
    String status 
    DateTime createdAt 
    String createdById "❓"
    }
  

  "Prescription" {
    String id "🗝️"
    String organizationId 
    String patientId 
    String consultationId "❓"
    String doctorId 
    DateTime prescriptionDate 
    String items 
    String status 
    String dispensedById "❓"
    DateTime dispensedAt "❓"
    String notes "❓"
    Boolean isRefill 
    Int refillsAllowed 
    Int refillsRemaining "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "PharmacySale" {
    String id "🗝️"
    String organizationId 
    String patientId "❓"
    String prescriptionId "❓"
    String servedById "❓"
    DateTime saleDate 
    String saleType "❓"
    String items 
    Float subtotal 
    Float discountAmount 
    Float taxAmount 
    Float totalAmount 
    String paymentStatus 
    String paymentMethod "❓"
    Float amountPaid 
    Float amountDue "❓"
    String receiptNumber 
    DateTime createdAt 
    String createdById "❓"
    }
  

  "PharmacyPurchaseOrder" {
    String id "🗝️"
    String organizationId 
    String poNumber 
    String status 
    String supplierName 
    String supplierContact "❓"
    String supplierEmail "❓"
    DateTime orderDate 
    DateTime expectedDeliveryDate "❓"
    DateTime receivedDate "❓"
    String items 
    Float totalAmount 
    String notes "❓"
    String cancellationNote "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "LabTest" {
    String id "🗝️"
    String organizationId 
    String testName 
    String testCode "❓"
    String testCategory "❓"
    String testType "❓"
    String specimenType "❓"
    String specimenVolume "❓"
    String specimenContainer "❓"
    String resultType "❓"
    String unit "❓"
    String referenceRanges "❓"
    Float price "❓"
    Int turnaroundTime "❓"
    String department "❓"
    String preparationInstructions "❓"
    String clinicalSignificance "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "LabOrder" {
    String id "🗝️"
    String organizationId 
    String patientId 
    String consultationId "❓"
    String requestedById 
    DateTime orderDate 
    String orderNumber 
    String tests 
    String clinicalIndication "❓"
    String provisionalDiagnosis "❓"
    String priority 
    String status 
    DateTime sampleCollectedAt "❓"
    String sampleCollectedById "❓"
    String accessionNumber "❓"
    DateTime resultsEnteredAt "❓"
    String resultsEnteredById "❓"
    DateTime resultsVerifiedAt "❓"
    String resultsVerifiedById "❓"
    DateTime resultsReportedAt "❓"
    String notes "❓"
    String rejectionReason "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "LabResult" {
    String id "🗝️"
    String organizationId "❓"
    String orderId 
    String testId 
    String resultValue 
    String resultUnit "❓"
    Boolean isAbnormal 
    Boolean isCritical 
    String flag "❓"
    Float referenceRangeMin "❓"
    Float referenceRangeMax "❓"
    String referenceRangeText "❓"
    String qcLevel "❓"
    Boolean qcPassed "❓"
    String methodUsed "❓"
    String instrumentUsed "❓"
    String enteredById "❓"
    DateTime enteredAt 
    String verifiedById "❓"
    DateTime verifiedAt "❓"
    String comment "❓"
    String technicianNotes "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "RadiologyExam" {
    String id "🗝️"
    String organizationId 
    String examName 
    String examCode "❓"
    String examCategory "❓"
    String bodyPart "❓"
    String modality "❓"
    Float price "❓"
    Int estimatedDuration "❓"
    String preparationInstructions "❓"
    Boolean contrastRequired 
    String description "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "RadiologyOrder" {
    String id "🗝️"
    String organizationId 
    String patientId 
    String consultationId "❓"
    String requestedById 
    String examId 
    DateTime orderDate 
    String orderNumber 
    String clinicalIndication "❓"
    String provisionalDiagnosis "❓"
    String relevantHistory "❓"
    String urgency 
    String status 
    DateTime scheduledDate "❓"
    DateTime examPerformedAt "❓"
    String performedById "❓"
    DateTime reportCreatedAt "❓"
    String reportedById "❓"
    DateTime reportVerifiedAt "❓"
    String verifiedById "❓"
    String notes "❓"
    String cancellationReason "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "RadiologyReport" {
    String id "🗝️"
    String organizationId "❓"
    String orderId 
    String technique "❓"
    String findings "❓"
    String impression "❓"
    String recommendations "❓"
    Boolean hasCriticalFindings 
    String criticalFindings "❓"
    String criticalNotifiedTo "❓"
    DateTime criticalNotifiedAt "❓"
    Boolean comparedWithPrevious 
    String comparisonNotes "❓"
    String images "❓"
    String dicomStudyUid "❓"
    String templateUsed "❓"
    String reportedById "❓"
    DateTime reportedAt 
    String verifiedById "❓"
    DateTime verifiedAt "❓"
    String status 
    String amendmentReason "❓"
    DateTime amendedAt "❓"
    String amendedById "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "BillingService" {
    String id "🗝️"
    String organizationId 
    String serviceName 
    String serviceCode "❓"
    String serviceCategory "❓"
    String department "❓"
    Float unitPrice 
    Boolean isTaxable 
    Float taxPercentage 
    Boolean isCoveredByInsurance 
    Float insuranceCopayPercentage "❓"
    String description "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "Invoice" {
    String id "🗝️"
    String organizationId 
    String patientId 
    String consultationId "❓"
    String invoiceNumber 
    DateTime invoiceDate 
    DateTime dueDate "❓"
    String items 
    Float subtotal 
    Float discountAmount 
    Float discountPercentage 
    Float taxAmount 
    Float totalAmount 
    String paymentStatus 
    Float amountPaid 
    Float balanceDue "❓"
    Float insuranceClaimAmount 
    String insuranceClaimStatus "❓"
    Float patientCopayAmount 
    String status 
    String notes "❓"
    String termsAndConditions "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    DateTime cancelledAt "❓"
    String cancelledById "❓"
    String cancellationReason "❓"
    }
  

  "Payment" {
    String id "🗝️"
    String organizationId 
    String invoiceId 
    String patientId "❓"
    DateTime paymentDate 
    String receiptNumber 
    Float amount 
    String paymentMethod 
    String paymentReference "❓"
    String cardLastFour "❓"
    String mobileMoneyProvider "❓"
    String bankName "❓"
    String chequeNumber "❓"
    DateTime chequeDate "❓"
    String processedById "❓"
    Boolean isRefund 
    String refundReason "❓"
    String originalPaymentId "❓"
    String notes "❓"
    DateTime createdAt 
    String createdById "❓"
    }
  

  "DoctorCommissionConfig" {
    String id "🗝️"
    String organizationId 
    String doctorId 
    String commissionType 
    Float commissionRate 
    Boolean isActive 
    String notes "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "DoctorCommission" {
    String id "🗝️"
    String organizationId 
    String doctorId 
    String invoiceId "❓"
    Float invoiceAmount 
    Float commissionRate 
    String commissionType 
    Float commissionAmount 
    String status 
    String period "❓"
    DateTime settledAt "❓"
    String settledById "❓"
    String settlementNote "❓"
    String settlementRef "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "MachineIntegration" {
    String id "🗝️"
    String organizationId 
    String machineName 
    MachineType machineType 
    String manufacturer "❓"
    String model "❓"
    String serialNumber "❓"
    String department "❓"
    ConnectionType connectionType 
    String connectionDetails 
    String testMapping 
    Boolean isActive 
    ConnectionStatus connectionStatus 
    DateTime lastConnectedAt "❓"
    DateTime lastResultReceivedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String createdById "❓"
    }
  

  "MachineResultsQueue" {
    String id "🗝️"
    String organizationId 
    String machineIntegrationId 
    String rawData 
    String parsedData "❓"
    String patientIdentifier "❓"
    String matchedPatientId "❓"
    String testResults 
    QueueStatus status 
    String errorMessage "❓"
    DateTime receivedAt 
    DateTime processedAt "❓"
    }
  

  "IntegrationLog" {
    String id "🗝️"
    String organizationId "❓"
    String machineIntegrationId "❓"
    DateTime logDate 
    LogType logType "❓"
    String message 
    String details "❓"
    Int resultsImported 
    Int resultsFailed 
    DateTime createdAt 
    }
  

  "UserInvitation" {
    String id "🗝️"
    String organizationId 
    String email 
    String role 
    String departmentIds "❓"
    String token 
    DateTime expiresAt 
    InvitationStatus status 
    DateTime acceptedAt "❓"
    DateTime createdAt 
    String sentById 
    }
  

  "Permission" {
    String id "🗝️"
    String code 
    String name 
    String description "❓"
    String category 
    DateTime createdAt 
    }
  

  "RolePermission" {
    String id "🗝️"
    String role 
    String permissionId 
    Boolean canCreate 
    Boolean canRead 
    Boolean canUpdate 
    Boolean canDelete 
    }
  

  "UserActivity" {
    String id "🗝️"
    String organizationId "❓"
    String userId 
    String action 
    String entityType "❓"
    String entityId "❓"
    String details "❓"
    String ipAddress "❓"
    String userAgent "❓"
    DateTime timestamp 
    }
  

  "AuditLog" {
    String id "🗝️"
    String organizationId 
    String userId "❓"
    String userEmail "❓"
    String userRole "❓"
    String action 
    String entityType "❓"
    String entityId "❓"
    String oldValues "❓"
    String newValues "❓"
    String ipAddress "❓"
    String userAgent "❓"
    DateTime performedAt 
    String description "❓"
    String metadata "❓"
    }
  

  "Notification" {
    String id "🗝️"
    String organizationId 
    String userId 
    String notificationType "❓"
    String title 
    String message 
    String entityType "❓"
    String entityId "❓"
    String deliveryMethod "❓"
    Boolean isRead 
    DateTime readAt "❓"
    String priority 
    DateTime sendAt 
    DateTime sentAt "❓"
    DateTime createdAt 
    }
  

  "EaptsConfig" {
    String id "🗝️"
    String organizationId 
    String apiUrl 
    String apiKey 
    String facilityCode 
    Boolean isEnabled 
    Boolean autoSyncEnabled 
    Int syncIntervalMinutes 
    DateTime lastSyncAt "❓"
    String syncStatus "❓"
    String syncErrors "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "EaptsMedicationMapping" {
    String id "🗝️"
    String organizationId 
    String localDrugId 
    String eaptsDrugCode 
    String eaptsDrugName 
    String eaptsUnitOfMeasure "❓"
    String mappingStatus 
    DateTime lastSyncedAt "❓"
    String mappingNotes "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "EaptsTransaction" {
    String id "🗝️"
    String organizationId 
    String transactionType 
    DateTime transactionDate 
    String requestPayload "❓"
    String responsePayload "❓"
    String status 
    String errorMessage "❓"
    Int retryCount 
    String entityType "❓"
    String entityId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  
    "User" }o--|| "Organization" : "organization"
    "User" }o--|o "Department" : "department"
    "User" |o--|o "User" : "invitedBy"
    "Department" }o--|| "Organization" : "organization"
    "Patient" }o--|| "Organization" : "organization"
    "PreTriage" }o--|| "Organization" : "organization"
    "PreTriage" }o--|o "Patient" : "patient"
    "PreTriage" }o--|o "User" : "screenedBy"
    "PreTriage" }o--|o "User" : "routedBy"
    "QueueManagement" }o--|| "Organization" : "organization"
    "QueueManagement" }o--|o "Patient" : "patient"
    "QueueManagement" }o--|o "User" : "assignedTo"
    "TriageAssessment" }o--|| "Organization" : "organization"
    "TriageAssessment" }o--|| "Patient" : "patient"
    "TriageAssessment" }o--|o "User" : "triagedBy"
    "Appointment" }o--|| "Organization" : "organization"
    "Appointment" }o--|| "Patient" : "patient"
    "Appointment" }o--|o "User" : "doctor"
    "Appointment" }o--|o "User" : "checkedInBy"
    "Consultation" }o--|| "Organization" : "organization"
    "Consultation" }o--|| "Patient" : "patient"
    "Consultation" }o--|o "Appointment" : "appointment"
    "Consultation" }o--|| "User" : "doctor"
    "Ward" }o--|| "Organization" : "organization"
    "Ward" }o--|o "Department" : "department"
    "Bed" }o--|| "Organization" : "organization"
    "Bed" }o--|| "Ward" : "ward"
    "Admission" }o--|| "Organization" : "organization"
    "Admission" }o--|| "Patient" : "patient"
    "Admission" }o--|o "Bed" : "bed"
    "DeathCertificate" }o--|| "Organization" : "organization"
    "DeathCertificate" }o--|| "Patient" : "patient"
    "DeathCertificate" }o--|o "User" : "certifiedBy"
    "DeathCertificate" }o--|o "User" : "issuedBy"
    "PharmacyDrug" }o--|| "Organization" : "organization"
    "PharmacyBatch" }o--|| "PharmacyDrug" : "drug"
    "Prescription" }o--|| "Organization" : "organization"
    "Prescription" }o--|| "Patient" : "patient"
    "Prescription" }o--|o "Consultation" : "consultation"
    "Prescription" }o--|| "User" : "doctor"
    "Prescription" }o--|o "User" : "dispensedBy"
    "PharmacySale" }o--|| "Organization" : "organization"
    "PharmacySale" }o--|o "Patient" : "patient"
    "PharmacySale" }o--|o "Prescription" : "prescription"
    "PharmacySale" }o--|o "User" : "servedBy"
    "PharmacyPurchaseOrder" }o--|| "Organization" : "organization"
    "LabTest" }o--|| "Organization" : "organization"
    "LabOrder" }o--|| "Organization" : "organization"
    "LabOrder" }o--|| "Patient" : "patient"
    "LabOrder" }o--|o "Consultation" : "consultation"
    "LabOrder" }o--|| "User" : "requestedBy"
    "LabOrder" }o--|o "User" : "sampleCollectedBy"
    "LabResult" }o--|| "LabOrder" : "order"
    "LabResult" }o--|| "LabTest" : "test"
    "LabResult" }o--|o "User" : "enteredBy"
    "LabResult" }o--|o "User" : "verifiedBy"
    "RadiologyExam" }o--|| "Organization" : "organization"
    "RadiologyOrder" }o--|| "Organization" : "organization"
    "RadiologyOrder" }o--|| "Patient" : "patient"
    "RadiologyOrder" }o--|o "Consultation" : "consultation"
    "RadiologyOrder" }o--|| "User" : "requestedBy"
    "RadiologyOrder" }o--|o "User" : "performedBy"
    "RadiologyOrder" }o--|| "RadiologyExam" : "exam"
    "RadiologyReport" |o--|| "RadiologyOrder" : "order"
    "RadiologyReport" }o--|o "User" : "reportedBy"
    "BillingService" }o--|| "Organization" : "organization"
    "Invoice" }o--|| "Organization" : "organization"
    "Invoice" }o--|| "Patient" : "patient"
    "Invoice" }o--|o "Consultation" : "consultation"
    "Invoice" }o--|o "User" : "createdBy"
    "Invoice" }o--|o "User" : "cancelledBy"
    "Payment" }o--|| "Organization" : "organization"
    "Payment" }o--|| "Invoice" : "invoice"
    "Payment" }o--|o "Patient" : "patient"
    "Payment" }o--|o "User" : "processedBy"
    "DoctorCommissionConfig" }o--|| "Organization" : "organization"
    "DoctorCommissionConfig" |o--|| "User" : "doctor"
    "DoctorCommission" }o--|| "Organization" : "organization"
    "DoctorCommission" }o--|| "User" : "doctor"
    "DoctorCommission" }o--|o "User" : "settledBy"
    "MachineIntegration" |o--|| "MachineType" : "enum:machineType"
    "MachineIntegration" |o--|| "ConnectionType" : "enum:connectionType"
    "MachineIntegration" |o--|| "ConnectionStatus" : "enum:connectionStatus"
    "MachineIntegration" }o--|| "Organization" : "organization"
    "MachineResultsQueue" |o--|| "QueueStatus" : "enum:status"
    "MachineResultsQueue" }o--|| "Organization" : "organization"
    "MachineResultsQueue" }o--|| "MachineIntegration" : "machineIntegration"
    "MachineResultsQueue" }o--|o "Patient" : "patient"
    "IntegrationLog" |o--|o "LogType" : "enum:logType"
    "IntegrationLog" }o--|o "MachineIntegration" : "machineIntegration"
    "UserInvitation" |o--|| "InvitationStatus" : "enum:status"
    "UserInvitation" }o--|| "Organization" : "organization"
    "UserInvitation" }o--|| "User" : "sentBy"
    "RolePermission" }o--|| "Permission" : "permission"
    "UserActivity" }o--|| "User" : "user"
    "AuditLog" }o--|| "Organization" : "organization"
    "AuditLog" }o--|o "User" : "user"
    "Notification" }o--|| "Organization" : "organization"
    "Notification" }o--|| "User" : "user"
    "EaptsConfig" |o--|| "Organization" : "organization"
    "EaptsMedicationMapping" }o--|| "Organization" : "organization"
    "EaptsMedicationMapping" }o--|| "PharmacyDrug" : "drug"
    "EaptsTransaction" }o--|| "Organization" : "organization"
```
