
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_conversations": {
                  Row: {
                    "created_at": string,"farm_id": string | null,"id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"farm_id"?: string | null,"id"?: string,"title"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"farm_id"?: string | null,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_conversations_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_conversations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"metadata": Json | null,"role": string,"sources": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"metadata"?: Json | null,"role": string,"sources"?: Json | null
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: Json | null,"role"?: string,"sources"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_rate_limits": {
                  Row: {
                    "request_count": number,"user_id": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "request_count"?: number,"user_id": string,"window_start"?: string
                  }
                  Update: {
                    "request_count"?: number,"user_id"?: string,"window_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_rate_limits_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"climate_cache": {
                  Row: {
                    "data": NonNullable<Json>,"end_year": number,"expires_at": string,"fetched_at": string,"id": string,"latitude": number,"longitude": number,"source": string,"start_year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "data": NonNullable<Json>,"end_year": number,"expires_at": string,"fetched_at"?: string,"id"?: string,"latitude": number,"longitude": number,"source"?: string,"start_year": number
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"end_year"?: number,"expires_at"?: string,"fetched_at"?: string,"id"?: string,"latitude"?: number,"longitude"?: number,"source"?: string,"start_year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"crop_activities": {
                  Row: {
                    "activity_date": string,"activity_type": Database["public"]['Enums']["activity_type"],"client_mutation_id": string | null,"cost": number | null,"created_at": string,"description": string | null,"farm_crop_id": string,"id": string,"notes": string | null,"photo_urls": (string)[] | null,"quantity": number | null,"unit": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_date": string,"activity_type": Database["public"]['Enums']["activity_type"],"client_mutation_id"?: string | null,"cost"?: number | null,"created_at"?: string,"description"?: string | null,"farm_crop_id": string,"id"?: string,"notes"?: string | null,"photo_urls"?: (string)[] | null,"quantity"?: number | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "activity_date"?: string,"activity_type"?: Database["public"]['Enums']["activity_type"],"client_mutation_id"?: string | null,"cost"?: number | null,"created_at"?: string,"description"?: string | null,"farm_crop_id"?: string,"id"?: string,"notes"?: string | null,"photo_urls"?: (string)[] | null,"quantity"?: number | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crop_activities_farm_crop_id_fkey"
      columns: ["farm_crop_id"]
isOneToOne: false
      referencedRelation: "farm_crops"
      referencedColumns: ["id"]
    }
                  ]
                },"crop_recommendations": {
                  Row: {
                    "created_at": string,"farm_id": string,"generated_at": string,"id": string,"input_parameters": NonNullable<Json>,"recommendations": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"farm_id": string,"generated_at"?: string,"id"?: string,"input_parameters": NonNullable<Json>,"recommendations": NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"farm_id"?: string,"generated_at"?: string,"id"?: string,"input_parameters"?: NonNullable<Json>,"recommendations"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crop_recommendations_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crop_recommendations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"crop_varieties": {
                  Row: {
                    "created_at": string,"crop_id": string,"description": string | null,"duration_days": number | null,"id": string,"name": string,"recommended_season": string | null,"seed_rate_per_acre": number | null,"source": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"crop_id": string,"description"?: string | null,"duration_days"?: number | null,"id"?: string,"name": string,"recommended_season"?: string | null,"seed_rate_per_acre"?: number | null,"source"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"crop_id"?: string,"description"?: string | null,"duration_days"?: number | null,"id"?: string,"name"?: string,"recommended_season"?: string | null,"seed_rate_per_acre"?: number | null,"source"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "crop_varieties_crop_id_fkey"
      columns: ["crop_id"]
isOneToOne: false
      referencedRelation: "crops"
      referencedColumns: ["id"]
    }
                  ]
                },"crops": {
                  Row: {
                    "category": Database["public"]['Enums']["crop_category"],"cost_max_per_acre": number | null,"cost_min_per_acre": number | null,"created_at": string,"fertilizer_requirements": Json | null,"growing_duration_days": number | null,"growth_stages": Json | null,"id": string,"is_active": boolean,"major_diseases": (string)[] | null,"major_pests": (string)[] | null,"market_commodities": (string)[] | null,"max_ph": number | null,"max_rainfall": number | null,"max_temp": number | null,"min_ph": number | null,"min_rainfall": number | null,"min_temp": number | null,"name": string,"name_hi": string | null,"name_mr": string | null,"optimal_rainfall_max": number | null,"optimal_rainfall_min": number | null,"optimal_temp_max": number | null,"optimal_temp_min": number | null,"reference_notes": string | null,"reference_source": string | null,"scientific_name": string | null,"seasons": (string)[] | null,"seed_rate_per_acre": number | null,"seed_unit": string | null,"slug": string | null,"sowing_windows": Json | null,"suitable_soil_types": (string)[] | null,"typical_yield_per_acre": number | null,"updated_at": string,"water_requirement": Database["public"]['Enums']["water_requirement_level"] | null,"yield_max_per_acre": number | null,"yield_min_per_acre": number | null,"yield_unit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["crop_category"],"cost_max_per_acre"?: number | null,"cost_min_per_acre"?: number | null,"created_at"?: string,"fertilizer_requirements"?: Json | null,"growing_duration_days"?: number | null,"growth_stages"?: Json | null,"id"?: string,"is_active"?: boolean,"major_diseases"?: (string)[] | null,"major_pests"?: (string)[] | null,"market_commodities"?: (string)[] | null,"max_ph"?: number | null,"max_rainfall"?: number | null,"max_temp"?: number | null,"min_ph"?: number | null,"min_rainfall"?: number | null,"min_temp"?: number | null,"name": string,"name_hi"?: string | null,"name_mr"?: string | null,"optimal_rainfall_max"?: number | null,"optimal_rainfall_min"?: number | null,"optimal_temp_max"?: number | null,"optimal_temp_min"?: number | null,"reference_notes"?: string | null,"reference_source"?: string | null,"scientific_name"?: string | null,"seasons"?: (string)[] | null,"seed_rate_per_acre"?: number | null,"seed_unit"?: string | null,"slug"?: string | null,"sowing_windows"?: Json | null,"suitable_soil_types"?: (string)[] | null,"typical_yield_per_acre"?: number | null,"updated_at"?: string,"water_requirement"?: Database["public"]['Enums']["water_requirement_level"] | null,"yield_max_per_acre"?: number | null,"yield_min_per_acre"?: number | null,"yield_unit"?: string | null
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["crop_category"],"cost_max_per_acre"?: number | null,"cost_min_per_acre"?: number | null,"created_at"?: string,"fertilizer_requirements"?: Json | null,"growing_duration_days"?: number | null,"growth_stages"?: Json | null,"id"?: string,"is_active"?: boolean,"major_diseases"?: (string)[] | null,"major_pests"?: (string)[] | null,"market_commodities"?: (string)[] | null,"max_ph"?: number | null,"max_rainfall"?: number | null,"max_temp"?: number | null,"min_ph"?: number | null,"min_rainfall"?: number | null,"min_temp"?: number | null,"name"?: string,"name_hi"?: string | null,"name_mr"?: string | null,"optimal_rainfall_max"?: number | null,"optimal_rainfall_min"?: number | null,"optimal_temp_max"?: number | null,"optimal_temp_min"?: number | null,"reference_notes"?: string | null,"reference_source"?: string | null,"scientific_name"?: string | null,"seasons"?: (string)[] | null,"seed_rate_per_acre"?: number | null,"seed_unit"?: string | null,"slug"?: string | null,"sowing_windows"?: Json | null,"suitable_soil_types"?: (string)[] | null,"typical_yield_per_acre"?: number | null,"updated_at"?: string,"water_requirement"?: Database["public"]['Enums']["water_requirement_level"] | null,"yield_max_per_acre"?: number | null,"yield_min_per_acre"?: number | null,"yield_unit"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"category": Database["public"]['Enums']["expense_category"],"client_mutation_id": string | null,"created_at": string,"currency": string,"description": string | null,"expense_date": string | null,"farm_crop_id": string | null,"farm_id": string,"id": string,"notes": string | null,"payment_method": string | null,"receipt_url": string | null,"synced_at": string | null,"updated_at": string,"user_id": string,"vendor": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": Database["public"]['Enums']["expense_category"],"client_mutation_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"expense_date"?: string | null,"farm_crop_id"?: string | null,"farm_id": string,"id"?: string,"notes"?: string | null,"payment_method"?: string | null,"receipt_url"?: string | null,"synced_at"?: string | null,"updated_at"?: string,"user_id": string,"vendor"?: string | null
                  }
                  Update: {
                    "amount"?: number,"category"?: Database["public"]['Enums']["expense_category"],"client_mutation_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"expense_date"?: string | null,"farm_crop_id"?: string | null,"farm_id"?: string,"id"?: string,"notes"?: string | null,"payment_method"?: string | null,"receipt_url"?: string | null,"synced_at"?: string | null,"updated_at"?: string,"user_id"?: string,"vendor"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_farm_crop_id_fkey"
      columns: ["farm_crop_id"]
isOneToOne: false
      referencedRelation: "farm_crops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"farm_crops": {
                  Row: {
                    "actual_harvest_date": string | null,"area_planted": number | null,"area_unit": string,"created_at": string,"crop_id": string,"current_stage": Database["public"]['Enums']["crop_stage"],"expected_harvest_date": string | null,"farm_id": string,"field_id": string | null,"harvest_quantity": number | null,"harvest_unit": string | null,"id": string,"notes": string | null,"seed_cost": number | null,"seed_quantity": number | null,"sowing_date": string | null,"status": Database["public"]['Enums']["crop_status"],"updated_at": string,"variety": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_harvest_date"?: string | null,"area_planted"?: number | null,"area_unit"?: string,"created_at"?: string,"crop_id": string,"current_stage"?: Database["public"]['Enums']["crop_stage"],"expected_harvest_date"?: string | null,"farm_id": string,"field_id"?: string | null,"harvest_quantity"?: number | null,"harvest_unit"?: string | null,"id"?: string,"notes"?: string | null,"seed_cost"?: number | null,"seed_quantity"?: number | null,"sowing_date"?: string | null,"status"?: Database["public"]['Enums']["crop_status"],"updated_at"?: string,"variety"?: string | null
                  }
                  Update: {
                    "actual_harvest_date"?: string | null,"area_planted"?: number | null,"area_unit"?: string,"created_at"?: string,"crop_id"?: string,"current_stage"?: Database["public"]['Enums']["crop_stage"],"expected_harvest_date"?: string | null,"farm_id"?: string,"field_id"?: string | null,"harvest_quantity"?: number | null,"harvest_unit"?: string | null,"id"?: string,"notes"?: string | null,"seed_cost"?: number | null,"seed_quantity"?: number | null,"sowing_date"?: string | null,"status"?: Database["public"]['Enums']["crop_status"],"updated_at"?: string,"variety"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "farm_crops_crop_id_fkey"
      columns: ["crop_id"]
isOneToOne: false
      referencedRelation: "crops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "farm_crops_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "farm_crops_field_id_fkey"
      columns: ["field_id"]
isOneToOne: false
      referencedRelation: "farm_fields"
      referencedColumns: ["id"]
    }
                  ]
                },"farm_documents": {
                  Row: {
                    "created_at": string,"document_type": string,"farm_crop_id": string | null,"farm_id": string | null,"file_path": string,"file_size": number | null,"id": string,"mime_type": string | null,"notes": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document_type"?: string,"farm_crop_id"?: string | null,"farm_id"?: string | null,"file_path": string,"file_size"?: number | null,"id"?: string,"mime_type"?: string | null,"notes"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"document_type"?: string,"farm_crop_id"?: string | null,"farm_id"?: string | null,"file_path"?: string,"file_size"?: number | null,"id"?: string,"mime_type"?: string | null,"notes"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "farm_documents_farm_crop_id_fkey"
      columns: ["farm_crop_id"]
isOneToOne: false
      referencedRelation: "farm_crops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "farm_documents_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "farm_documents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"farm_fields": {
                  Row: {
                    "area": number | null,"area_unit": string,"created_at": string,"farm_id": string,"id": string,"irrigation_available": boolean,"name": string,"notes": string | null,"soil_ph": number | null,"soil_type": string | null,"updated_at": string,"water_source": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: number | null,"area_unit"?: string,"created_at"?: string,"farm_id": string,"id"?: string,"irrigation_available"?: boolean,"name": string,"notes"?: string | null,"soil_ph"?: number | null,"soil_type"?: string | null,"updated_at"?: string,"water_source"?: string | null
                  }
                  Update: {
                    "area"?: number | null,"area_unit"?: string,"created_at"?: string,"farm_id"?: string,"id"?: string,"irrigation_available"?: boolean,"name"?: string,"notes"?: string | null,"soil_ph"?: number | null,"soil_type"?: string | null,"updated_at"?: string,"water_source"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "farm_fields_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    }
                  ]
                },"farm_tasks": {
                  Row: {
                    "client_mutation_id": string | null,"created_at": string,"description": string | null,"due_date": string | null,"farm_crop_id": string | null,"farm_id": string,"id": string,"priority": Database["public"]['Enums']["task_priority"],"recurrence": string | null,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_mutation_id"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"farm_crop_id"?: string | null,"farm_id": string,"id"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"recurrence"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "client_mutation_id"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"farm_crop_id"?: string | null,"farm_id"?: string,"id"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"recurrence"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "farm_tasks_farm_crop_id_fkey"
      columns: ["farm_crop_id"]
isOneToOne: false
      referencedRelation: "farm_crops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "farm_tasks_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "farm_tasks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"farms": {
                  Row: {
                    "annual_budget": number | null,"area_unit": string,"created_at": string,"district": string | null,"farming_season": string | null,"id": string,"irrigation_available": boolean,"is_primary": boolean,"land_slope": string | null,"latitude": number | null,"longitude": number | null,"name": string,"soil_ph": number | null,"soil_type": string | null,"state": string | null,"taluka": string | null,"total_area": number | null,"updated_at": string,"user_id": string,"village": string | null,"water_source": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "annual_budget"?: number | null,"area_unit"?: string,"created_at"?: string,"district"?: string | null,"farming_season"?: string | null,"id"?: string,"irrigation_available"?: boolean,"is_primary"?: boolean,"land_slope"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"name": string,"soil_ph"?: number | null,"soil_type"?: string | null,"state"?: string | null,"taluka"?: string | null,"total_area"?: number | null,"updated_at"?: string,"user_id": string,"village"?: string | null,"water_source"?: string | null
                  }
                  Update: {
                    "annual_budget"?: number | null,"area_unit"?: string,"created_at"?: string,"district"?: string | null,"farming_season"?: string | null,"id"?: string,"irrigation_available"?: boolean,"is_primary"?: boolean,"land_slope"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"soil_ph"?: number | null,"soil_type"?: string | null,"state"?: string | null,"taluka"?: string | null,"total_area"?: number | null,"updated_at"?: string,"user_id"?: string,"village"?: string | null,"water_source"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "farms_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"income_records": {
                  Row: {
                    "amount": number,"buyer": string | null,"category": Database["public"]['Enums']["income_category"],"client_mutation_id": string | null,"created_at": string,"currency": string,"description": string | null,"farm_crop_id": string | null,"farm_id": string,"id": string,"income_date": string | null,"market_name": string | null,"notes": string | null,"price_per_unit": number | null,"quantity": number | null,"synced_at": string | null,"unit": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"buyer"?: string | null,"category": Database["public"]['Enums']["income_category"],"client_mutation_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"farm_crop_id"?: string | null,"farm_id": string,"id"?: string,"income_date"?: string | null,"market_name"?: string | null,"notes"?: string | null,"price_per_unit"?: number | null,"quantity"?: number | null,"synced_at"?: string | null,"unit"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"buyer"?: string | null,"category"?: Database["public"]['Enums']["income_category"],"client_mutation_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"farm_crop_id"?: string | null,"farm_id"?: string,"id"?: string,"income_date"?: string | null,"market_name"?: string | null,"notes"?: string | null,"price_per_unit"?: number | null,"quantity"?: number | null,"synced_at"?: string | null,"unit"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "income_records_farm_crop_id_fkey"
      columns: ["farm_crop_id"]
isOneToOne: false
      referencedRelation: "farm_crops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "income_records_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "income_records_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"knowledge_articles": {
                  Row: {
                    "body_en": string | null,"body_hi": string | null,"body_mr": string | null,"category": string,"created_at": string,"id": string,"is_active": boolean,"last_verified": string | null,"slug": string,"source": string | null,"summary_en": string | null,"summary_hi": string | null,"summary_mr": string | null,"title_en": string,"title_hi": string | null,"title_mr": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_en"?: string | null,"body_hi"?: string | null,"body_mr"?: string | null,"category": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"last_verified"?: string | null,"slug": string,"source"?: string | null,"summary_en"?: string | null,"summary_hi"?: string | null,"summary_mr"?: string | null,"title_en": string,"title_hi"?: string | null,"title_mr"?: string | null
                  }
                  Update: {
                    "body_en"?: string | null,"body_hi"?: string | null,"body_mr"?: string | null,"category"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"last_verified"?: string | null,"slug"?: string,"source"?: string | null,"summary_en"?: string | null,"summary_hi"?: string | null,"summary_mr"?: string | null,"title_en"?: string,"title_hi"?: string | null,"title_mr"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"market_imports": {
                  Row: {
                    "created_at": string,"error_message": string | null,"file_name": string,"id": string,"inserted_count": number,"row_count": number,"skipped_count": number,"source": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_message"?: string | null,"file_name": string,"id"?: string,"inserted_count"?: number,"row_count"?: number,"skipped_count"?: number,"source"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"error_message"?: string | null,"file_name"?: string,"id"?: string,"inserted_count"?: number,"row_count"?: number,"skipped_count"?: number,"source"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "market_imports_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"market_prices": {
                  Row: {
                    "arrival_date": string | null,"commodity": string,"created_at": string,"district": string | null,"fetched_at": string,"id": string,"import_batch": string | null,"market_name": string | null,"max_price": number | null,"min_price": number | null,"modal_price": number | null,"source": string | null,"source_url": string | null,"state": string | null,"variety": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arrival_date"?: string | null,"commodity": string,"created_at"?: string,"district"?: string | null,"fetched_at"?: string,"id"?: string,"import_batch"?: string | null,"market_name"?: string | null,"max_price"?: number | null,"min_price"?: number | null,"modal_price"?: number | null,"source"?: string | null,"source_url"?: string | null,"state"?: string | null,"variety"?: string | null
                  }
                  Update: {
                    "arrival_date"?: string | null,"commodity"?: string,"created_at"?: string,"district"?: string | null,"fetched_at"?: string,"id"?: string,"import_batch"?: string | null,"market_name"?: string | null,"max_price"?: number | null,"min_price"?: number | null,"modal_price"?: number | null,"source"?: string | null,"source_url"?: string | null,"state"?: string | null,"variety"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"data": Json | null,"id": string,"is_read": boolean,"message": string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data"?: Json | null,"id"?: string,"is_read"?: boolean,"message"?: string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"data"?: Json | null,"id"?: string,"is_read"?: boolean,"message"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string | null,"full_name": string | null,"id": string,"onboarding_completed": boolean,"phone": string | null,"preferred_language": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"onboarding_completed"?: boolean,"phone"?: string | null,"preferred_language"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"onboarding_completed"?: boolean,"phone"?: string | null,"preferred_language"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"schemes": {
                  Row: {
                    "application_url": string,"benefits": string | null,"created_at": string,"eligibility": (string)[],"id": string,"is_active": boolean,"last_verified": string,"level": string,"name": string,"name_hi": string | null,"name_mr": string | null,"official_source": string,"required_documents": (string)[],"slug": string,"state": string | null,"summary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_url": string,"benefits"?: string | null,"created_at"?: string,"eligibility"?: (string)[],"id"?: string,"is_active"?: boolean,"last_verified": string,"level": string,"name": string,"name_hi"?: string | null,"name_mr"?: string | null,"official_source": string,"required_documents"?: (string)[],"slug": string,"state"?: string | null,"summary": string
                  }
                  Update: {
                    "application_url"?: string,"benefits"?: string | null,"created_at"?: string,"eligibility"?: (string)[],"id"?: string,"is_active"?: boolean,"last_verified"?: string,"level"?: string,"name"?: string,"name_hi"?: string | null,"name_mr"?: string | null,"official_source"?: string,"required_documents"?: (string)[],"slug"?: string,"state"?: string | null,"summary"?: string
                  }
                  Relationships: [
                    
                  ]
                },"soil_records": {
                  Row: {
                    "created_at": string,"farm_id": string,"field_id": string | null,"id": string,"lab_name": string | null,"nitrogen": number | null,"notes": string | null,"organic_carbon": number | null,"ph": number | null,"phosphorus": number | null,"potassium": number | null,"report_url": string | null,"soil_type": string | null,"test_date": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"farm_id": string,"field_id"?: string | null,"id"?: string,"lab_name"?: string | null,"nitrogen"?: number | null,"notes"?: string | null,"organic_carbon"?: number | null,"ph"?: number | null,"phosphorus"?: number | null,"potassium"?: number | null,"report_url"?: string | null,"soil_type"?: string | null,"test_date"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"farm_id"?: string,"field_id"?: string | null,"id"?: string,"lab_name"?: string | null,"nitrogen"?: number | null,"notes"?: string | null,"organic_carbon"?: number | null,"ph"?: number | null,"phosphorus"?: number | null,"potassium"?: number | null,"report_url"?: string | null,"soil_type"?: string | null,"test_date"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "soil_records_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "soil_records_field_id_fkey"
      columns: ["field_id"]
isOneToOne: false
      referencedRelation: "farm_fields"
      referencedColumns: ["id"]
    }
                  ]
                },"source_registry": {
                  Row: {
                    "created_at": string,"data_quality": string | null,"dataset": string,"dataset_url": string | null,"geographic_coverage": string | null,"id": string,"last_verified": string | null,"notes": string | null,"provider": string,"retrieval_method": string | null,"update_frequency": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data_quality"?: string | null,"dataset": string,"dataset_url"?: string | null,"geographic_coverage"?: string | null,"id"?: string,"last_verified"?: string | null,"notes"?: string | null,"provider": string,"retrieval_method"?: string | null,"update_frequency"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"data_quality"?: string | null,"dataset"?: string,"dataset_url"?: string | null,"geographic_coverage"?: string | null,"id"?: string,"last_verified"?: string | null,"notes"?: string | null,"provider"?: string,"retrieval_method"?: string | null,"update_frequency"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"user_preferences": {
                  Row: {
                    "area_unit": string,"created_at": string,"currency": string,"dashboard_layout": Json | null,"default_farm_id": string | null,"id": string,"notifications_enabled": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_unit"?: string,"created_at"?: string,"currency"?: string,"dashboard_layout"?: Json | null,"default_farm_id"?: string | null,"id"?: string,"notifications_enabled"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "area_unit"?: string,"created_at"?: string,"currency"?: string,"dashboard_layout"?: Json | null,"default_farm_id"?: string | null,"id"?: string,"notifications_enabled"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_preferences_default_farm_id_fkey"
      columns: ["default_farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"weather_alerts": {
                  Row: {
                    "alert_date": string,"alert_type": string,"created_at": string,"farm_id": string,"forecast_fetched_at": string,"id": string,"is_dismissed": boolean,"message": string,"severity": string,"source": string,"title": string,"unit": string | null,"user_id": string,"value": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_date": string,"alert_type": string,"created_at"?: string,"farm_id": string,"forecast_fetched_at": string,"id"?: string,"is_dismissed"?: boolean,"message": string,"severity": string,"source"?: string,"title": string,"unit"?: string | null,"user_id": string,"value"?: number | null
                  }
                  Update: {
                    "alert_date"?: string,"alert_type"?: string,"created_at"?: string,"farm_id"?: string,"forecast_fetched_at"?: string,"id"?: string,"is_dismissed"?: boolean,"message"?: string,"severity"?: string,"source"?: string,"title"?: string,"unit"?: string | null,"user_id"?: string,"value"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "weather_alerts_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weather_alerts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"weather_cache": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"data_type": Database["public"]['Enums']["weather_data_type"],"expires_at": string,"fetched_at": string,"id": string,"latitude": number,"longitude": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data": NonNullable<Json>,"data_type": Database["public"]['Enums']["weather_data_type"],"expires_at": string,"fetched_at"?: string,"id"?: string,"latitude": number,"longitude": number
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"data_type"?: Database["public"]['Enums']["weather_data_type"],"expires_at"?: string,"fetched_at"?: string,"id"?: string,"latitude"?: number,"longitude"?: number
                  }
                  Relationships: [
                    
                  ]
                },"weather_records": {
                  Row: {
                    "et0_mm": number | null,"fetched_at": string,"humidity": number | null,"id": string,"latitude": number,"longitude": number,"observation_time": string | null,"rain_probability": number | null,"rainfall_mm": number | null,"record_date": string,"source": string,"temp_max": number | null,"temp_min": number | null,"weather_code": number | null,"wind_speed": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "et0_mm"?: number | null,"fetched_at"?: string,"humidity"?: number | null,"id"?: string,"latitude": number,"longitude": number,"observation_time"?: string | null,"rain_probability"?: number | null,"rainfall_mm"?: number | null,"record_date": string,"source"?: string,"temp_max"?: number | null,"temp_min"?: number | null,"weather_code"?: number | null,"wind_speed"?: number | null
                  }
                  Update: {
                    "et0_mm"?: number | null,"fetched_at"?: string,"humidity"?: number | null,"id"?: string,"latitude"?: number,"longitude"?: number,"observation_time"?: string | null,"rain_probability"?: number | null,"rainfall_mm"?: number | null,"record_date"?: string,"source"?: string,"temp_max"?: number | null,"temp_min"?: number | null,"weather_code"?: number | null,"wind_speed"?: number | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assert_farm_owned":
{ Args: { "p_farm_id": string,"p_user_id": string }; Returns: undefined
                           },
"farm_financial_summary":
{ Args: { "p_farm_id": string }; Returns: Json
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           }
          }
          Enums: {
            "activity_type": "sowing"|"irrigation"|"fertilizer"|"pesticide"|"weeding"|"pruning"|"harvesting"|"observation"|"other","crop_category": "cereals"|"pulses"|"oilseeds"|"vegetables"|"fruits"|"spices"|"cash_crops"|"fibers","crop_stage": "land_preparation"|"sowing"|"germination"|"vegetative"|"flowering"|"fruiting"|"harvesting"|"completed","crop_status": "active"|"completed"|"failed","expense_category": "seeds"|"fertilizers"|"pesticides"|"labour"|"machinery"|"irrigation"|"electricity"|"transportation"|"fuel"|"land_preparation"|"equipment"|"other","income_category": "crop_sale"|"product_sale"|"subsidy"|"insurance"|"other","notification_type": "weather_alert"|"task_reminder"|"market_alert"|"system","task_priority": "low"|"medium"|"high","task_status": "pending"|"in_progress"|"completed"|"cancelled","water_requirement_level": "low"|"medium"|"high","weather_data_type": "current"|"forecast"|"historical"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "activity_type": ["sowing", "irrigation", "fertilizer", "pesticide", "weeding", "pruning", "harvesting", "observation", "other"],"crop_category": ["cereals", "pulses", "oilseeds", "vegetables", "fruits", "spices", "cash_crops", "fibers"],"crop_stage": ["land_preparation", "sowing", "germination", "vegetative", "flowering", "fruiting", "harvesting", "completed"],"crop_status": ["active", "completed", "failed"],"expense_category": ["seeds", "fertilizers", "pesticides", "labour", "machinery", "irrigation", "electricity", "transportation", "fuel", "land_preparation", "equipment", "other"],"income_category": ["crop_sale", "product_sale", "subsidy", "insurance", "other"],"notification_type": ["weather_alert", "task_reminder", "market_alert", "system"],"task_priority": ["low", "medium", "high"],"task_status": ["pending", "in_progress", "completed", "cancelled"],"water_requirement_level": ["low", "medium", "high"],"weather_data_type": ["current", "forecast", "historical"]
          }
        }
} as const
